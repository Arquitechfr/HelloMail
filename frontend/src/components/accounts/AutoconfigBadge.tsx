"use client";

import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";

interface AutoconfigBadgeProps {
  loading: boolean;
  detected: boolean;
  source?: string;
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  hasTypedDomain: boolean;
}

export function AutoconfigBadge({
  loading,
  detected,
  source,
  imapHost,
  imapPort,
  smtpHost,
  smtpPort,
  hasTypedDomain,
}: AutoconfigBadgeProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 animate-pulse">
        <Loader2 className="size-3.5 animate-spin text-primary" />
        <span>Détection automatique des serveurs IMAP/SMTP...</span>
      </div>
    );
  }

  if (detected) {
    return (
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2 animate-in fade-in">
        <CheckCircle2 className="size-4 shrink-0 mt-0.5 text-emerald-500" />
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold flex items-center gap-1">
            <Sparkles className="size-3" /> Paramètres détectés automatiquement
            {source && (
              <span className="font-mono text-[10px] uppercase opacity-75">
                ({source})
              </span>
            )}
          </span>
          <span className="text-[11px] opacity-90">
            IMAP: {imapHost}:{imapPort} · SMTP: {smtpHost}:{smtpPort}
          </span>
        </div>
      </div>
    );
  }

  if (hasTypedDomain) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 animate-in fade-in">
        <AlertCircle className="size-4 shrink-0 text-amber-500" />
        <span>Domaine non reconnu automatiquement. Renseignez vos serveurs ci-dessous.</span>
      </div>
    );
  }

  return null;
}
