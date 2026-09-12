"use client";

import { ShieldAlert, AlertTriangle } from "lucide-react";
import type { EmailSecuritySummary } from "@/lib/api-types";

interface EmailSecurityBannerProps {
  summary?: EmailSecuritySummary;
  senderEmail: string;
}

export function EmailSecurityBanner({ summary, senderEmail }: EmailSecurityBannerProps) {
  if (!summary) return null;

  const hasCriticalFail =
    summary.dmarc === "fail" || summary.dkim === "fail" || summary.spf === "fail" || summary.isSpam;

  if (!hasCriticalFail && !summary.warningMessage) {
    return null;
  }

  const message =
    summary.warningMessage ||
    `Attention : l'authenticité de cet expéditeur (${senderEmail}) n'a pas pu être vérifiée. Méfiez-vous des liens ou pièces jointes.`;

  return (
    <div className="mx-6 mt-4 mb-2 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300">
        {summary.dmarc === "fail" || summary.dkim === "fail" ? (
          <ShieldAlert className="size-4" />
        ) : (
          <AlertTriangle className="size-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-amber-950 dark:text-amber-100 mb-0.5">
          Avertissement de sécurité
        </h4>
        <p className="leading-relaxed opacity-90">{message}</p>
      </div>
    </div>
  );
}
