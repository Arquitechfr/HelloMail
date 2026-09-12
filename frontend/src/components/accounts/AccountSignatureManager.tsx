"use client";

import { useState } from "react";
import { useAccounts, useUpdateSignature, useUpdateAliasSignature } from "@/lib/queries/accounts";
import { type Account, type SignatureConfig } from "@/lib/api-types";
import { AccountSignatureIdentityEditor } from "./AccountSignatureIdentityEditor";
import { Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";

interface SingleAccountSignatureProps {
  account: Account;
}

function SingleAccountSignature({ account }: SingleAccountSignatureProps) {
  const updateSignature = useUpdateSignature();
  const updateAliasSignature = useUpdateAliasSignature();

  // "main" ou l'identifiant de l'alias sélectionné
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("main");

  const aliases = account.aliases || [];
  const selectedAlias = selectedIdentityId !== "main" ? aliases.find((a) => a._id === selectedIdentityId) : undefined;

  const handleSaveMain = (config: SignatureConfig) => {
    updateSignature.mutate(
      {
        id: account._id,
        signature: config,
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

  const handleSaveAlias = (aliasId: string, aliasEmail: string, config: SignatureConfig) => {
    updateAliasSignature.mutate(
      {
        accountId: account._id,
        aliasId,
        signature: config,
      },
      {
        onSuccess: () => {
          toast.success(`Signature mise à jour pour l'alias ${aliasEmail}`);
        },
        onError: () => {
          toast.error("Erreur lors de la sauvegarde de la signature de l'alias");
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card/40 p-4 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-foreground">{account.emailAddress}</span>
            {account.color && (
              <span
                className="size-2 rounded-full inline-block"
                style={{ backgroundColor: account.color }}
              />
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">
            {account.displayName ? account.displayName : "Compte de messagerie"}
          </span>
        </div>

        {aliases.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Users className="size-3.5 text-primary" />
            <span>{aliases.length} alias configuré{aliases.length > 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {/* Sélecteur d'identité si le compte possède des alias */}
      {aliases.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/40">
          <button
            type="button"
            onClick={() => setSelectedIdentityId("main")}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer select-none ${
              selectedIdentityId === "main"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Mail className="size-3" />
            <span>Principal ({account.emailAddress})</span>
          </button>

          {aliases.map((alias) => (
            <button
              key={alias._id}
              type="button"
              onClick={() => setSelectedIdentityId(alias._id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer select-none ${
                selectedIdentityId === alias._id
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{alias.email}</span>
              {alias.name && <span className="opacity-70 text-[10px]">({alias.name})</span>}
            </button>
          ))}
        </div>
      )}

      {/* Éditeur de la signature pour l'identité active */}
      {selectedIdentityId === "main" ? (
        <AccountSignatureIdentityEditor
          key={`main-${account._id}`}
          emailAddress={account.emailAddress}
          displayName={account.displayName}
          signature={account.signature}
          onSave={handleSaveMain}
          isSaving={updateSignature.isPending}
        />
      ) : selectedAlias ? (
        <AccountSignatureIdentityEditor
          key={`alias-${selectedAlias._id}`}
          emailAddress={selectedAlias.email}
          displayName={selectedAlias.name || account.displayName}
          signature={selectedAlias.signature || account.signature}
          isAlias
          onSave={(cfg) => handleSaveAlias(selectedAlias._id, selectedAlias.email, cfg)}
          isSaving={updateAliasSignature.isPending}
        />
      ) : null}
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
