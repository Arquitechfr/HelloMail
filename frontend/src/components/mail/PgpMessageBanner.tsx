"use client";

import { useState } from "react";
import { usePgpUserKeys, usePgpContactPublicKey } from "@/lib/queries/pgp";
import {
  isPgpEncrypted,
  isPgpSigned,
  decryptPgpMessage,
  verifyPgpSignature,
  type PgpDecryptedResult,
} from "@/lib/pgp/pgpCrypto";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Unlock, ShieldCheck, AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface PgpMessageBannerProps {
  content?: string;
  senderEmail?: string;
  onDecrypted?: (decryptedText: string) => void;
}

export function PgpMessageBanner({
  content,
  senderEmail,
  onDecrypted,
}: PgpMessageBannerProps) {
  const { data: myKeys = [] } = usePgpUserKeys();
  const { data: senderKey } = usePgpContactPublicKey(senderEmail);

  const isEncrypted = isPgpEncrypted(content);
  const isSigned = isPgpSigned(content);

  const [decryptedResult, setDecryptedResult] = useState<PgpDecryptedResult | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPassphraseInput, setShowPassphraseInput] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [verifiedCleartext, setVerifiedCleartext] = useState<{
    valid: boolean;
  } | null>(null);

  if (!isEncrypted && !isSigned) {
    return null;
  }

  const handleDecrypt = async (withPassphrase = passphrase) => {
    if (!content) return;
    const userPrivateKey = myKeys.find((k) => k.armoredPrivateKey)?.armoredPrivateKey;

    if (!userPrivateKey) {
      toast.error("Aucune clé privée OpenPGP trouvée dans vos réglages pour déchiffrer ce message.");
      return;
    }

    setDecrypting(true);
    try {
      // Extraction du bloc PGP MESSAGE
      const match = content.match(/-----BEGIN PGP MESSAGE-----[\s\S]+?-----END PGP MESSAGE-----/);
      const armoredMessage = match ? match[0] : content;

      const result = await decryptPgpMessage({
        armoredMessage,
        armoredPrivateKey: userPrivateKey,
        passphrase: withPassphrase || undefined,
        senderPublicKeyArmored: senderKey?.armoredPublicKey,
      });

      setDecryptedResult(result);
      setShowPassphraseInput(false);
      onDecrypted?.(result.decryptedText);
      toast.success("Message déchiffré localement avec succès");
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      if (
        errMsg.toLowerCase().includes("passphrase") ||
        errMsg.toLowerCase().includes("key is encrypted")
      ) {
        setShowPassphraseInput(true);
        toast.info("Une passphrase est requise pour déverrouiller votre clé privée");
      } else {
        toast.error("Impossible de déchiffrer ce message. Vérifiez la clé ou la passphrase.");
      }
    } finally {
      setDecrypting(false);
    }
  };

  const handleVerifyCleartext = async () => {
    if (!content) return;
    try {
      const match = content.match(
        /-----BEGIN PGP SIGNED MESSAGE-----[\s\S]+?-----END PGP SIGNATURE-----/,
      );
      const armoredSignedMessage = match ? match[0] : content;

      const result = await verifyPgpSignature({
        armoredSignedMessage,
        senderPublicKeyArmored: senderKey?.armoredPublicKey,
      });

      setVerifiedCleartext({ valid: result.signatureValid });
      if (result.signatureValid) {
        toast.success("Signature OpenPGP authentifiée avec succès");
      } else {
        toast.warning(
          senderKey
            ? "Signature OpenPGP invalide"
            : "Signature présente, mais clé publique de l'expéditeur non enregistrée",
        );
      }
    } catch {
      toast.error("Erreur lors de la vérification de la signature");
    }
  };

  // Message chiffré et déjà déchiffré
  if (decryptedResult) {
    return (
      <div className="mx-6 mt-3 mb-1 flex items-center justify-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-emerald-950 dark:text-emerald-200 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <Unlock className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="min-w-0 text-xs">
            <span className="font-semibold">Message déchiffré de bout en bout (OpenPGP)</span>
            {decryptedResult.isSigned && (
              <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="size-3" />
                {decryptedResult.signatureValid
                  ? "Signature expéditeur authentifiée"
                  : "Signé (clé expéditeur non vérifiée)"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Message chiffré non encore déchiffré
  if (isEncrypted) {
    return (
      <div className="mx-6 mt-3 mb-1 flex flex-col gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-indigo-950 dark:text-indigo-200 no-print">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Lock className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-semibold">Ce message est chiffré avec OpenPGP</p>
              <p className="text-[11px] text-muted-foreground">
                Le contenu est confidentiel et ne peut être lu qu'avec votre clé privée.
              </p>
            </div>
          </div>
          {!showPassphraseInput && (
            <Button
              size="sm"
              onClick={() => handleDecrypt()}
              disabled={decrypting}
              className="gap-1.5 h-7 px-3 text-xs font-medium shrink-0 cursor-pointer"
            >
              {decrypting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <KeyRound className="size-3.5" />
              )}
              <span>Déchiffrer</span>
            </Button>
          )}
        </div>

        {showPassphraseInput && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDecrypt(passphrase);
            }}
            className="flex items-center gap-2 pt-1"
          >
            <Input
              type="password"
              placeholder="Passphrase de votre clé privée..."
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              autoFocus
              className="h-7 text-xs flex-1 bg-background/80"
            />
            <Button
              type="submit"
              size="sm"
              disabled={decrypting || !passphrase}
              className="h-7 text-xs shrink-0"
            >
              {decrypting ? <Loader2 className="size-3.5 animate-spin" /> : "Déverrouiller"}
            </Button>
          </form>
        )}
      </div>
    );
  }

  // Message signé en clair
  return (
    <div className="mx-6 mt-3 mb-1 flex items-center justify-between gap-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2.5 text-sky-950 dark:text-sky-200 no-print">
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck className="size-4 text-sky-600 dark:text-sky-400 shrink-0" />
        <div className="min-w-0 text-xs">
          <span className="font-semibold">Message signé numériquement (OpenPGP)</span>
          {verifiedCleartext !== null && (
            <span className="ml-2 font-medium">
              {verifiedCleartext.valid
                ? "— Signature certifiée authentique"
                : "— Signature non vérifiée"}
            </span>
          )}
        </div>
      </div>
      {verifiedCleartext === null && (
        <Button
          size="xs"
          variant="outline"
          onClick={handleVerifyCleartext}
          className="text-xs h-6 px-2 shrink-0 border-sky-500/30"
        >
          Vérifier la signature
        </Button>
      )}
    </div>
  );
}
