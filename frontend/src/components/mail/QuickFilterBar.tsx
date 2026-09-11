"use client";

import { cn } from "@/lib/utils";
import { Mail, Star, Pin, Paperclip, Check } from "lucide-react";

export type QuickFilter = "all" | "unread" | "pinned" | "attachments";

interface QuickFilterBarProps {
  currentFilter: QuickFilter;
  onFilterChange: (filter: QuickFilter) => void;
  className?: string;
  counts?: {
    all?: number;
    unread?: number;
    pinned?: number;
    attachments?: number;
  };
}

export function QuickFilterBar({
  currentFilter,
  onFilterChange,
  className,
  counts,
}: QuickFilterBarProps) {
  const filters: Array<{
    id: QuickFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    { id: "all", label: "Tous", icon: Mail, count: counts?.all },
    { id: "unread", label: "Non lus", icon: Mail, count: counts?.unread },
    { id: "pinned", label: "Épinglés", icon: Pin, count: counts?.pinned },
    { id: "attachments", label: "Pièces jointes", icon: Paperclip, count: counts?.attachments },
  ];

  return (
    <div className={cn("flex items-center gap-1 overflow-x-auto py-1 px-3 no-scrollbar select-none", className)}>
      {filters.map((f) => {
        const Icon = f.icon;
        const isActive = currentFilter === f.id;

        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors shrink-0 cursor-pointer border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-2xs font-semibold"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border/50",
            )}
          >
            <Icon className={cn("size-3 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
            <span>{f.label}</span>
            {f.count !== undefined && f.count > 0 && (
              <span
                className={cn(
                  "font-mono text-[9px] px-1 rounded-full",
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {f.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
