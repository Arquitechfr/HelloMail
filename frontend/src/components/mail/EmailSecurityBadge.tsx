"use client";

import { useState, useRef, useEffect } from "react";
import type { EmailSecuritySummary, SecurityVerdict } from "@/lib/api-types";
import { ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailSecurityBadgeProps {
  summary?: EmailSecuritySummary;
  senderEmail: string;
  className?: string;
}

function getVerdictInfo(verdict: SecurityVerdict): {
  label: string;
  badgeClass: string;
  icon: typeof CheckCircle2;
} {
  switch (verdict) {
    case "pass":
      return {
        label: "Valide",
        badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        icon: CheckCircle2,
      };
    case "fail":
      return {
        label: "Échec",
        badgeClass: "bg-destructive/15 text-destructive border-destructive/20",
        icon: XCircle,
      };
    case "neutral":
      return {
        label: "Neutre",
        badgeClass: "bg-muted text-muted-foreground border-border",
        icon: HelpCircle,
      };
    default:
      return {
        label: "Inconnu",
        badgeClass: "bg-muted/60 text-muted-foreground border-border/50",
        icon: HelpCircle,
      };
  }
}

export function EmailSecurityBadge({
  summary,
  senderEmail,
  className,
}: EmailSecurityBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const spf = summary?.spf ?? "unknown";
  const dkim = summary?.dkim ?? "unknown";
  const dmarc = summary?.dmarc ?? "unknown";
  const isTrusted = summary?.isTrusted ?? false;
  const hasFail = spf === "fail" || dkim === "fail" || dmarc === "fail" || summary?.isSpam;

  // Détermination du style principal du badge
  let badgeLabel = "Non vérifié";
  let badgeIcon = ShieldAlert;
  let badgeStyle = "bg-muted/50 text-muted-foreground border-border/60 hover:bg-muted";

  if (hasFail) {
    badgeLabel = "Alerte de sécurité";
    badgeIcon = ShieldX;
    badgeStyle = "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25";
  } else if (isTrusted) {
    badgeLabel = "Expéditeur vérifié";
    badgeIcon = ShieldCheck;
    badgeStyle = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20";
  }

  const Icon = badgeIcon;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer select-none",
          badgeStyle,
          className
        )}
        title="Consulter les détails de sécurité et d'authentification de l'expéditeur"
      >
        <Icon className="size-3 shrink-0" />
        <span>{badgeLabel}</span>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl">
          <div className="flex items-center gap-2 pb-2 mb-2 border-b border-border/60">
            <Icon className="size-4 shrink-0 text-foreground" />
            <div className="min-w-0">
              <h4 className="text-xs font-semibold font-display truncate">Sécurité de l&apos;expéditeur</h4>
              <p className="text-[10px] text-muted-foreground truncate">{senderEmail}</p>
            </div>
          </div>

          {summary?.warningMessage && (
            <div className="mb-2.5 p-2 rounded bg-destructive/10 border border-destructive/20 text-destructive text-[11px] leading-tight">
              {summary.warningMessage}
            </div>
          )}

          <div className="space-y-1.5 text-xs">
            {/* DMARC */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-mono">DMARC</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.2 rounded border font-medium",
                  getVerdictInfo(dmarc).badgeClass
                )}
              >
                {getVerdictInfo(dmarc).label}
              </span>
            </div>

            {/* DKIM */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-mono">DKIM (Signature)</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.2 rounded border font-medium",
                  getVerdictInfo(dkim).badgeClass
                )}
              >
                {getVerdictInfo(dkim).label}
              </span>
            </div>

            {/* SPF */}
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground font-mono">SPF (Autorisation)</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.2 rounded border font-medium",
                  getVerdictInfo(spf).badgeClass
                )}
              >
                {getVerdictInfo(spf).label}
              </span>
            </div>

            {summary?.spamScore !== undefined && (
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Score anti-spam</span>
                <span className="font-mono text-muted-foreground">{summary.spamScore}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
