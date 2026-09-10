"use client";

import { useState } from "react";
import { useDeleteAccount, useToggleAccount } from "@/lib/queries/accounts";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Account } from "@/lib/api-types";
import { EmailAvatar } from "@/components/mail/EmailAvatar";
import { MoreVertical, Trash2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AccountItemProps {
  account: Account;
  isSelected: boolean;
  onSelect: () => void;
}

export function AccountItem({ account, isSelected, onSelect }: AccountItemProps) {
  const toggleAccount = useToggleAccount();
  const deleteAccount = useDeleteAccount();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleToggle = () => {
    toggleAccount.mutate(
      { id: account._id, isActive: !account.isActive },
      {
        onError: (err) => {
          if (err instanceof ApiError) toast.error(err.message);
          else toast.error("Erreur lors du changement d'état");
        },
      },
    );
  };

  const handleDelete = () => {
    deleteAccount.mutate(account._id, {
      onSuccess: () => toast.success("Compte supprimé"),
      onError: (err) => {
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error("Erreur lors de la suppression");
      },
    });
    setConfirmDelete(false);
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors cursor-pointer",
        isSelected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50",
      )}
      onClick={onSelect}
    >
      <EmailAvatar
        email={account.emailAddress}
        name={account.displayName}
        className="size-8 shrink-0"
        fallbackClassName="text-xs font-medium"
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">
          {account.displayName ?? account.emailAddress}
        </span>
        <span className="truncate text-xs text-muted-foreground">{account.emailAddress}</span>
      </div>

      {account.lastSyncError && (
        <AlertCircle className="size-4 shrink-0 text-destructive" />
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          className="opacity-0 group-hover:opacity-100 inline-flex shrink-0 items-center justify-center rounded-md size-8 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
          >
            {account.isActive ? "Désactiver" : "Activer"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmDelete(true);
            }}
          >
            <Trash2 className="size-4" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(false);
          }}
        >
          <div
            className="rounded-xl border border-border bg-card p-5 max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold">Supprimer ce compte ?</h3>
                <p className="text-sm text-muted-foreground">{account.emailAddress}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Cette action est irréversible. Les identifiants chiffrés seront supprimés.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteAccount.isPending}>
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
