"use client";

import { useRef, useEffect, useCallback } from "react";
import { formatSignatureHtml } from "@/lib/compose-utils";
import type { Account } from "@/lib/api-types";
import { toast } from "sonner";

interface UseComposeSignatureOptions {
  currentAccount?: Account;
  mode: "new" | "reply" | "forward";
  body: string;
  setBody: React.Dispatch<React.SetStateAction<string>>;
  hasRestoredData?: boolean;
}

export function useComposeSignature({
  currentAccount,
  mode,
  body,
  setBody,
  hasRestoredData,
}: UseComposeSignatureOptions) {
  const handleInsertSignature = useCallback(() => {
    if (!currentAccount) return;
    const sigText =
      currentAccount.signature?.text?.trim() ||
      `-- \nBien cordialement,\n${currentAccount.displayName || currentAccount.emailAddress}`;
    const sigHtml =
      currentAccount.signature?.html || formatSignatureHtml(sigText);

    setBody((prev) => {
      const significantLine =
        sigText
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l && !l.startsWith("-")) || sigText;

      if (prev && prev.includes(significantLine)) {
        toast.info("La signature est déjà présente dans le message");
        return prev;
      }
      return prev && prev !== "<p></p>" ? `${prev}${sigHtml}` : `<p></p>${sigHtml}`;
    });
    toast.success("Signature insérée");
  }, [currentAccount, setBody]);

  // Insertion automatique de la signature si activée et nouveau message
  const signatureInsertedRef = useRef(Boolean(hasRestoredData));
  useEffect(() => {
    if (
      mode === "new" &&
      currentAccount?.signature?.enabled &&
      !body &&
      !signatureInsertedRef.current
    ) {
      signatureInsertedRef.current = true;
      const sigText =
        currentAccount.signature.text?.trim() ||
        `-- \nBien cordialement,\n${currentAccount.displayName || currentAccount.emailAddress}`;
      const sigHtml =
        currentAccount.signature.html || formatSignatureHtml(sigText);
      setBody(`<p></p>${sigHtml}`);
    }
  }, [mode, currentAccount, body, setBody]);

  return { handleInsertSignature };
}
