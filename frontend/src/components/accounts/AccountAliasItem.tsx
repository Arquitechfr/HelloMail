"use client";

import { Button } from "@/components/ui/button";
import { Star, Edit2, Trash2 } from "lucide-react";
import type { AccountAlias } from "@/lib/api-types";

interface AccountAliasItemProps {
  alias: AccountAlias;
  onSetDefault: (alias: AccountAlias) => void;
  onEdit: (alias: AccountAlias) => void;
  onDelete: (aliasId: string) => void;
  isDeleting: boolean;
}

export function AccountAliasItem({
  alias,
  onSetDefault,
  onEdit,
  onDelete,
  isDeleting,
}: AccountAliasItemProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 p-2.5 text-xs bg-muted/10 hover:bg-muted/30 transition-colors shadow-2xs">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground truncate">{alias.email}</span>
          {alias.isDefault && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
              <Star className="size-2.5 fill-primary" /> Défaut
            </span>
          )}
        </div>
        {alias.name && <div className="text-[11px] text-muted-foreground truncate">{alias.name}</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {!alias.isDefault && (
          <Button
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
            title="Définir par défaut"
            onClick={() => onSetDefault(alias)}
          >
            <Star className="size-3.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
          title="Modifier"
          onClick={() => onEdit(alias)}
        >
          <Edit2 className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-destructive/80 hover:text-destructive cursor-pointer"
          title="Supprimer"
          onClick={() => onDelete(alias._id)}
          disabled={isDeleting}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
