"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ServerSettingsAccordionProps {
  imapHost: string;
  imapPort: string;
  imapSecure: boolean;
  imapUsername: string;
  smtpHost: string;
  smtpPort: string;
  smtpSecure: boolean;
  onUpdate: (key: string, value: string | boolean) => void;
}

export function ServerSettingsAccordion({
  imapHost,
  imapPort,
  imapSecure,
  imapUsername,
  smtpHost,
  smtpPort,
  smtpSecure,
  onUpdate,
}: ServerSettingsAccordionProps) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/80 bg-muted/20 p-3.5 animate-in fade-in duration-200">
      {/* IMAP */}
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Serveur entrant (IMAP)</span>
          <span className="text-[10px] text-muted-foreground font-normal">Réception</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="imapHost" className="text-[11px] text-muted-foreground">
              Hôte IMAP
            </Label>
            <Input
              id="imapHost"
              value={imapHost}
              onChange={(e) => onUpdate("imapHost", e.target.value)}
              placeholder="imap.exemple.com"
              className="h-8 text-xs bg-background"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="imapPort" className="text-[11px] text-muted-foreground">
              Port
            </Label>
            <Input
              id="imapPort"
              type="number"
              value={imapPort}
              onChange={(e) => onUpdate("imapPort", e.target.value)}
              placeholder="993"
              className="h-8 text-xs bg-background"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="imapSecure"
            type="checkbox"
            checked={imapSecure}
            onChange={(e) => onUpdate("imapSecure", e.target.checked)}
            className="size-3.5 rounded accent-primary cursor-pointer"
          />
          <Label htmlFor="imapSecure" className="text-xs font-normal cursor-pointer text-muted-foreground">
            Sécurité SSL/TLS (recommandé)
          </Label>
        </div>

        <div className="flex flex-col gap-1">
          <Label htmlFor="imapUsername" className="text-[11px] text-muted-foreground">
            Nom d&apos;utilisateur IMAP (si différent de l&apos;email)
          </Label>
          <Input
            id="imapUsername"
            value={imapUsername}
            onChange={(e) => onUpdate("imapUsername", e.target.value)}
            placeholder="Laisser vide pour utiliser l'email"
            className="h-8 text-xs bg-background"
          />
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* SMTP */}
      <div className="flex flex-col gap-2.5">
        <h4 className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>Serveur sortant (SMTP)</span>
          <span className="text-[10px] text-muted-foreground font-normal">Envoi</span>
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="smtpHost" className="text-[11px] text-muted-foreground">
              Hôte SMTP
            </Label>
            <Input
              id="smtpHost"
              value={smtpHost}
              onChange={(e) => onUpdate("smtpHost", e.target.value)}
              placeholder="smtp.exemple.com"
              className="h-8 text-xs bg-background"
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="smtpPort" className="text-[11px] text-muted-foreground">
              Port
            </Label>
            <Input
              id="smtpPort"
              type="number"
              value={smtpPort}
              onChange={(e) => onUpdate("smtpPort", e.target.value)}
              placeholder="465"
              className="h-8 text-xs bg-background"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <input
            id="smtpSecure"
            type="checkbox"
            checked={smtpSecure}
            onChange={(e) => onUpdate("smtpSecure", e.target.checked)}
            className="size-3.5 rounded accent-primary cursor-pointer"
          />
          <Label htmlFor="smtpSecure" className="text-xs font-normal cursor-pointer text-muted-foreground">
            Sécurité SSL/TLS (recommandé)
          </Label>
        </div>
      </div>
    </div>
  );
}
