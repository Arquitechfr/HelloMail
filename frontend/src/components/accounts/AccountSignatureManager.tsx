"use client";

import { useState } from "react";
import { useAccounts, useUpdateSignature } from "@/lib/queries/accounts";
import { type Account } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

interface SingleAccountSignatureProps {
  account: Account;
}

function getDefaultSignature(account: Account): string {
  const name = account.displayName?.trim() || account.emailAddress.split("@")[0];
  return `-- \nBien cordialement,\n${name}\n${account.emailAddress}`;
}

function SingleAccountSignature({ account }: SingleAccountSignatureProps) {
  const updateSignature = useUpdateSignature();
  const [enabled, setEnabled] = useState(account.signature?.enabled ?? false);
  const [text, setText] = useState(
    account.signature?.text || (account.signature?.enabled ? getDefaultSignature(account) : "")
  );

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked && !text.trim()) {
      setText(getDefaultSignature(account));
    }
  };

  const handleResetToDefault = () => {
    setText(getDefaultSignature(account));
    toast.info("Modèle de signature appliqué");
  };

  const handleSave = () => {
    const finalText = enabled && !text.trim() ? getDefaultSignature(account) : text;
    if (enabled && !text.trim()) {
      setText(finalText);
    }

    updateSignature.mutate(
      {
        id: account._id,
        signature: { enabled, text: finalText },
      },
      {
        onSuccess: () => {
          toast.success(`Signature mise à jour pour ${account.emailAddress}`);
        },
        onError: () => {
          toast.error("Erreur lors de la sauvegarde de la signature");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/40 p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground">{account.emailAddress}</span>
          <span className="text-[11px] text-muted-foreground">
            {account.displayName ? account.displayName : "Compte de messagerie"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label
            htmlFor={`sig-toggle-${account._id}`}
            className="flex items-center gap-2 cursor-pointer text-xs font-medium text-muted-foreground select-none"
          >
            <input
              id={`sig-toggle-${account._id}`}
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              className="size-4 accent-primary rounded cursor-pointer"
            />
            <span>Activer la signature</span>
          </label>
        </div>
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor={`sig-text-${account._id}`} className="text-xs text-muted-foreground">
                Texte de signature
              </Label>
              <button
                type="button"
                onClick={handleResetToDefault}
                className="text-[11px] text-primary/80 hover:text-primary underline cursor-pointer"
              >
                Appliquer le modèle par défaut
              </button>
            </div>
            <textarea
              id={`sig-text-${account._id}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`--\nBien cordialement,\n${account.displayName || account.emailAddress}`}
              rows={4}
              className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-xs font-sans placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {text && (
            <div className="rounded border border-border/40 bg-muted/20 p-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Aperçu de la signature
              </span>
              <pre className="text-xs font-sans whitespace-pre-wrap text-muted-foreground">
                {text}
              </pre>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateSignature.isPending}
          className="h-7 text-xs gap-1.5"
        >
          {updateSignature.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

export function AccountSignatureManager() {
  const { data: accounts, isLoading } = useAccounts();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
        <Loader2 className="size-4 animate-spin" />
        Chargement des signatures...
      </div>
    );
  }

  if (!accounts || accounts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Aucun compte configuré. Ajoutez un compte pour définir une signature.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((acc) => (
        <SingleAccountSignature key={acc._id} account={acc} />
      ))}
    </div>
  );
}
