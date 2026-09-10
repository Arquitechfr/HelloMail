"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContactAutocomplete } from "@/components/mail/ContactAutocomplete";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ComposeRecipientsProps {
  currentAccount?: { displayName?: string; emailAddress: string };
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
  return (
    <>
      {/* Expéditeur */}
      {currentAccount && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b border-border/40">
          <span className="font-medium text-foreground">De :</span>
          <span className="font-medium text-foreground/90">
            {currentAccount.displayName
              ? `${currentAccount.displayName} <${currentAccount.emailAddress}>`
              : currentAccount.emailAddress}
          </span>
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
