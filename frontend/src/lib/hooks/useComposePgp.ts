"use client";

import { useState } from "react";
import { usePgpUserKeys, usePgpContactKeys } from "@/lib/queries/pgp";
import { encryptPgpMessage } from "@/lib/pgp/pgpCrypto";
import { toast } from "sonner";

interface UseComposePgpOptions {
  fromAddress?: string;
}

export function useComposePgp({ fromAddress }: UseComposePgpOptions = {}) {
  const [pgpEncrypt, setPgpEncrypt] = useState(false);
  const [pgpSign, setPgpSign] = useState(false);

  const { data: myKeys = [] } = usePgpUserKeys();
  const { data: contactKeys = [] } = usePgpContactKeys();

  const processPgpPayload = async (options: {
    recipients: string[];
    plainText: string;
  }): Promise<string | null> => {
    if (!pgpEncrypt && !pgpSign) {
      return null;
    }

    const myKey =
      myKeys.find((k) => k.email.toLowerCase() === fromAddress?.toLowerCase()) ||
      myKeys[0];

    // Chiffrement
    if (pgpEncrypt) {
      const recipientArmoredKeys: string[] = [];

      for (const rec of options.recipients) {
        const normalized = rec.toLowerCase().trim();
        // Si c'est nous-même
        if (myKey && normalized === myKey.email.toLowerCase()) {
          recipientArmoredKeys.push(myKey.armoredPublicKey);
          continue;
        }

        const found = contactKeys.find(
          (k) => k.email.toLowerCase() === normalized,
        );
        if (!found) {
          toast.error(
            `Clé publique OpenPGP manquante pour ${rec}. Enregistrez sa clé dans les réglages pour lui envoyer un message chiffré.`,
          );
          return ""; // Erreur signalée
        }
        recipientArmoredKeys.push(found.armoredPublicKey);
      }

      // Inclure notre propre clé pour pouvoir relire le message envoyé
      if (myKey && !recipientArmoredKeys.includes(myKey.armoredPublicKey)) {
        recipientArmoredKeys.push(myKey.armoredPublicKey);
      }

      try {
        const encrypted = await encryptPgpMessage({
          plainText: options.plainText,
          recipientPublicKeysArmored: recipientArmoredKeys,
          senderPrivateKeyArmored: pgpSign ? myKey?.armoredPrivateKey : undefined,
        });
        return encrypted;
      } catch {
        toast.error("Erreur lors du chiffrement OpenPGP du message");
        return "";
      }
    }

    return null;
  };

  return {
    pgpEncrypt,
    setPgpEncrypt,
    pgpSign,
    setPgpSign,
    hasMyKey: myKeys.length > 0,
    processPgpPayload,
  };
}
