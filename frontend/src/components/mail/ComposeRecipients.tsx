"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactAutocomplete } from "@/components/mail/ContactAutocomplete";
import { useAccountAliases } from "@/lib/queries/aliases";
import type { Account } from "@/lib/api-types";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface SenderIdentity {
  name?: string;
  address: string;
  isDefault: boolean;
  label: string;
}

interface ComposeRecipientsProps {
  currentAccount?: Account;
  from?: { name?: string; address: string };
  onFromChange?: (from: { name?: string; address: string }) => void;
  to: string;
  onToChange: (to: string) => void;
  cc: string;
  onCcChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bcc: string;
  onBccChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  subject: string;
  onSubjectChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showCcBcc: boolean;
  onToggleCcBcc: () => void;
}

export function ComposeRecipients({
  currentAccount,
  from,
  onFromChange,
  to,
  onToChange,
  cc,
  onCcChange,
  bcc,
  onBccChange,
  subject,
  onSubjectChange,
  showCcBcc,
  onToggleCcBcc,
}: ComposeRecipientsProps) {
  const { data: fetchedAliases } = useAccountAliases(currentAccount?._id);

  const identities = useMemo((): SenderIdentity[] => {
    if (!currentAccount) return [];

    const aliases = fetchedAliases || currentAccount.aliases || [];
    const hasDefaultAlias = aliases.some((a) => a.isDefault);

    const primaryIdentity: SenderIdentity = {
      name: currentAccount.displayName,
      address: currentAccount.emailAddress,
      isDefault: !hasDefaultAlias,
      label: currentAccount.displayName
        ? `${currentAccount.displayName} <${currentAccount.emailAddress}>`
        : currentAccount.emailAddress,
    };

    const aliasIdentities: SenderIdentity[] = aliases.map((alias) => ({
      name: alias.name || currentAccount.displayName,
      address: alias.email,
      isDefault: alias.isDefault,
      label: alias.name
        ? `${alias.name} <${alias.email}>`
        : alias.email,
    }));

    return [primaryIdentity, ...aliasIdentities];
  }, [currentAccount, fetchedAliases]);

  // Initialisation automatique avec l'identité par défaut
  useEffect(() => {
    if (!onFromChange || identities.length === 0) return;

    if (!from) {
      const defaultId = identities.find((i) => i.isDefault) || identities[0];
      if (defaultId) {
        onFromChange({ name: defaultId.name, address: defaultId.address });
      }
    }
  }, [identities, from, onFromChange]);

  const selectedAddress =
    from?.address.toLowerCase() ||
    currentAccount?.emailAddress.toLowerCase() ||
    "";

  return (
    <>
      {/* Expéditeur */}
      {currentAccount && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b border-border/40">
          <span className="font-medium text-foreground shrink-0">De :</span>
          {identities.length > 1 ? (
            <select
              id="compose-from-select"
              aria-label="Sélectionner l'expéditeur"
              value={selectedAddress}
              onChange={(e) => {
                const found = identities.find(
                  (i) => i.address.toLowerCase() === e.target.value.toLowerCase(),
                );
                if (found && onFromChange) {
                  onFromChange({ name: found.name, address: found.address });
                }
              }}
              className="h-7 rounded-md border border-input bg-background/50 px-2 py-0.5 text-xs text-foreground font-medium shadow-xs focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer max-w-full truncate"
            >
              {identities.map((identity) => (
                <option key={identity.address} value={identity.address.toLowerCase()}>
                  {identity.label} {identity.isDefault ? "★" : ""}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-medium text-foreground/90 truncate">
              {currentAccount.displayName
                ? `${currentAccount.displayName} <${currentAccount.emailAddress}>`
                : currentAccount.emailAddress}
            </span>
          )}
        </div>
      )}

      {/* Destinataire + toggle Cc/Cci */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="to">À</Label>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onToggleCcBcc}
            className="text-xs text-muted-foreground"
          >
            {showCcBcc ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            Cc / Cci
          </Button>
        </div>
        <ContactAutocomplete
          id="to"
          value={to}
          onChange={onToChange}
          placeholder="destinataire@exemple.com"
          required
        />
      </div>

      {/* Cc / Cci (conditionnels) */}
      {showCcBcc && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cc">Cc</Label>
            <Input id="cc" value={cc} onChange={onCcChange} placeholder="(optionnel)" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bcc">Cci</Label>
            <Input id="bcc" value={bcc} onChange={onBccChange} placeholder="(optionnel)" />
          </div>
        </>
      )}

      {/* Sujet */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Sujet</Label>
        <Input
          id="subject"
          value={subject}
          onChange={onSubjectChange}
          placeholder="Sujet du message"
          required
        />
      </div>
    </>
  );
}
