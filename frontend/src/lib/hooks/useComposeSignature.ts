"use client";

import { useRef, useEffect, useCallback } from "react";
import { formatSignatureHtml, replaceOrAppendSignature } from "@/lib/compose-utils";
import { resolveSignatureVariables } from "@/lib/signature-utils";
import type { Account, SignatureConfig } from "@/lib/api-types";
import { toast } from "sonner";

export interface ActiveSender {
  name?: string;
  address: string;
}

interface UseComposeSignatureOptions {
  currentAccount?: Account;
  activeSender?: ActiveSender;
  mode: "new" | "reply" | "forward";
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  hasRestoredData?: boolean;
}

function getEffectiveSignature(
  account: Account | undefined,
  sender: ActiveSender | undefined,
): { config?: SignatureConfig; displayName: string; emailAddress: string } {
  if (!account) {
    return {
      displayName: sender?.name || "",
      emailAddress: sender?.address || "",
    };
  }

  const emailAddress = sender?.address || account.emailAddress;
  const isAlias = emailAddress.toLowerCase() !== account.emailAddress.toLowerCase();
  const alias = isAlias
    ? account.aliases?.find((a) => a.email.toLowerCase() === emailAddress.toLowerCase())
    : undefined;

  // Si l'alias a une signature propre activée, on l'utilise
  if (alias?.signature?.enabled) {
    return {
      config: alias.signature,
      displayName: sender?.name || alias.name || account.displayName || "",
      emailAddress,
    };
  }

  // Sinon, signature du compte principal
  return {
    config: account.signature,
    displayName: sender?.name || account.displayName || "",
    emailAddress,
  };
}

export function useComposeSignature({
  currentAccount,
  activeSender,
  mode,
  body,
  setBody,
  hasRestoredData,
}: UseComposeSignatureOptions) {
  const previousSenderAddressRef = useRef<string | undefined>(activeSender?.address);
  const signatureInsertedRef = useRef(Boolean(hasRestoredData));

  const resolveHtml = useCallback(
    (account?: Account, sender?: ActiveSender) => {
      const { config, displayName, emailAddress } = getEffectiveSignature(account, sender);
      const rawHtml = config?.html || (config?.text ? formatSignatureHtml(config.text) : undefined);
      if (!rawHtml) {
        const fallbackText = `-- \nBien cordialement,\n${displayName || emailAddress}`;
        return formatSignatureHtml(fallbackText);
      }
      return resolveSignatureVariables(rawHtml, {
        displayName,
        emailAddress,
        variables: config?.variables || account?.signature?.variables,
      });
    },
    [],
  );

  const handleInsertSignature = useCallback(() => {
    if (!currentAccount) return;
    const resolvedSigHtml = resolveHtml(currentAccount, activeSender);

    setBody((prev) => replaceOrAppendSignature(prev, resolvedSigHtml));
    toast.success("Signature insérée");
  }, [currentAccount, activeSender, resolveHtml, setBody]);

  // Insertion automatique initiale
  useEffect(() => {
    if (
      mode === "new" &&
      !body &&
      !signatureInsertedRef.current &&
      currentAccount
    ) {
      const { config } = getEffectiveSignature(currentAccount, activeSender);
      if (config?.enabled) {
        signatureInsertedRef.current = true;
        const resolvedSigHtml = resolveHtml(currentAccount, activeSender);
        setBody(replaceOrAppendSignature("", resolvedSigHtml));
      }
    }
  }, [mode, currentAccount, activeSender, body, resolveHtml, setBody]);

  // Changement dynamique d'expéditeur ("De :")
  useEffect(() => {
    const currentAddress = activeSender?.address || currentAccount?.emailAddress;
    const prevAddress = previousSenderAddressRef.current;
    previousSenderAddressRef.current = currentAddress;

    // Si l'adresse d'expéditeur a changé et qu'il y a déjà du contenu
    if (prevAddress && currentAddress && prevAddress !== currentAddress && currentAccount) {
      const { config } = getEffectiveSignature(currentAccount, activeSender);
      setBody((prev) => {
        if (!/<div data-signature="true"[^>]*>/i.test(prev)) {
          return prev;
        }
        if (!config?.enabled) {
          return replaceOrAppendSignature(prev, undefined);
        }
        const newSigHtml = resolveHtml(currentAccount, activeSender);
        return replaceOrAppendSignature(prev, newSigHtml);
      });
    }
  }, [activeSender?.address, currentAccount, activeSender, resolveHtml, setBody]);

  return { handleInsertSignature };
}

