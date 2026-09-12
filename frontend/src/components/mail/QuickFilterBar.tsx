"use client";

import { cn } from "@/lib/utils";
import { Mail, MailCheck, Star, Pin, Paperclip } from "lucide-react";
import {
  type QuickFilter,
  type QuickFilterCounts,
  QUICK_FILTERS_CONFIG,
} from "@/lib/quick-filters";

export type { QuickFilter, QuickFilterCounts };

interface QuickFilterBarProps {
  currentFilter: QuickFilter;
  onFilterChange: (filter: QuickFilter) => void;
  className?: string;
  counts?: Partial<QuickFilterCounts>;
}

const FILTER_ICONS: Record<QuickFilter, React.ComponentType<{ className?: string }>> = {
  all: Mail,
  unread: MailCheck,
  starred: Star,
  pinned: Pin,
  attachments: Paperclip,
};

export function QuickFilterBar({
  currentFilter,
  onFilterChange,
  className,
  counts,
}: QuickFilterBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Filtres rapides de messages"
      className={cn("flex items-center gap-1 overflow-x-auto py-1 px-3 no-scrollbar select-none", className)}
    >
      {QUICK_FILTERS_CONFIG.map((f) => {
        const Icon = FILTER_ICONS[f.id];
        const isActive = currentFilter === f.id;
        const count = counts?.[f.id];
        const hasNoMatches = count !== undefined && count === 0 && f.id !== "all";

        return (
          <button
            key={f.id}
            type="button"
            role="button"
            aria-pressed={isActive}
            title={`${f.label} (${f.shortcut})`}
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0 cursor-pointer border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                : cn(
                    "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50",
                    hasNoMatches && "opacity-60 hover:opacity-100"
                  )
            )}
          >
            <Icon
              className={cn(
                "size-3 shrink-0",
                isActive ? "text-primary-foreground" : "text-muted-foreground",
                f.id === "starred" && isActive && "fill-current"
              )}
            />
            <span>{f.label}</span>
            {count !== undefined && count > 0 && (
              <span
                className={cn(
                  "font-mono text-[9px] px-1 rounded-full",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
