"use client";

import { useAccountQuota, useRefreshAccountQuota } from "@/lib/queries/accounts";
import { formatStorageSize, formatDate } from "@/lib/utils";
import { HardDrive, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface StorageQuotaBarProps {
  accountId: string | null;
  className?: string;
  compact?: boolean;
}

/**
 * Jauge de stockage IMAP (RFC 2087) pour un compte donné.
 * S'adapte au taux d'occupation (<75% normal, 75-89% attention, ≥90% critique).
 * Ne s'affiche pas si le serveur IMAP ne supporte pas l'extension QUOTA.
 */
export function StorageQuotaBar({ accountId, className, compact = false }: StorageQuotaBarProps) {
  const { data: quota, isLoading } = useAccountQuota(accountId);
  const refreshMutation = useRefreshAccountQuota();

  if (!accountId || isLoading || !quota || quota.supported === false) {
    return null;
  }

  const percentage = quota.percentage ?? 0;
  const isCritical = percentage >= 90;
  const isWarning = percentage >= 75 && percentage < 90;

  const barColor = isCritical
    ? "bg-rose-500"
    : isWarning
      ? "bg-amber-500"
      : "bg-primary";

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshMutation.isPending || !accountId) return;

    refreshMutation.mutate(accountId, {
      onSuccess: () => {
        toast.success("Quota de stockage mis à jour");
      },
      onError: () => {
        toast.error("Impossible de rafraîchir le quota IMAP");
      },
    });
  };

  const formattedUsed = formatStorageSize(quota.usedBytes);
  const formattedTotal = formatStorageSize(quota.totalBytes);

  return (
    <div
      className={cn(
        "rounded-md border border-border/70 bg-background/50 px-2.5 py-2 text-xs transition-colors",
        isCritical && "border-rose-500/40 bg-rose-500/5",
        className,
      )}
      title={`Quota IMAP (RFC 2087)${quota.updatedAt ? ` — vérifié le ${formatDate(quota.updatedAt)}` : ""}`}
    >
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {isCritical ? (
            <AlertTriangle className="size-3.5 shrink-0 text-rose-500 animate-pulse" />
          ) : (
            <HardDrive className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-foreground truncate text-[11px]">
            {isCritical ? "Espace saturé" : "Stockage"}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              "font-mono text-[10px] font-semibold",
              isCritical
                ? "text-rose-600 dark:text-rose-400"
                : isWarning
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground",
            )}
          >
            {percentage}%
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshMutation.isPending}
            className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            title="Rafraîchir le quota IMAP"
            aria-label="Rafraîchir le quota IMAP"
          >
            <RefreshCw
              className={cn(
                "size-3",
                refreshMutation.isPending && "animate-spin text-primary",
              )}
            />
          </button>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="w-full bg-muted/80 rounded-full h-1.5 overflow-hidden">
        <div
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cn("h-full transition-all duration-300 rounded-full", barColor)}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </div>

      {!compact && quota.totalBytes && (
        <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <span>{formattedUsed}</span>
          <span>{formattedTotal}</span>
        </div>
      )}
    </div>
  );
}
