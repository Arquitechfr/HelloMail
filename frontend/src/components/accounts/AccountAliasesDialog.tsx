"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAccountAliases,
  useCreateAccountAlias,
  useUpdateAccountAlias,
  useDeleteAccountAlias,
} from "@/lib/queries/aliases";
import { ApiError } from "@/lib/api";
import type { Account, AccountAlias } from "@/lib/api-types";
import { Plus, Trash2, Edit2, Star, Check, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";

interface AccountAliasesDialogProps {
  account: Account;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AccountAliasesDialog({
  account,
  open,
  onOpenChange,
}: AccountAliasesDialogProps) {
  const { data: aliases = [], isLoading } = useAccountAliases(account._id);
  const createAlias = useCreateAccountAlias(account._id);
  const updateAlias = useUpdateAccountAlias(account._id);
  const deleteAlias = useDeleteAccountAlias(account._id);

  const [editingAlias, setEditingAlias] = useState<AccountAlias | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const resetForm = () => {
    setEditingAlias(null);
    setName("");
    setEmail("");
    setIsDefault(false);
    setFormOpen(false);
  };

  const startEdit = (alias: AccountAlias) => {
    setEditingAlias(alias);
    setName(alias.name || "");
    setEmail(alias.email);
    setIsDefault(alias.isDefault);
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("L'adresse email est requise");
      return;
    }

    if (editingAlias) {
      updateAlias.mutate(
        {
          aliasId: editingAlias._id,
          body: {
            name: name.trim() || undefined,
            email: email.trim().toLowerCase(),
            isDefault,
          },
        },
        {
          onSuccess: () => {
            toast.success("Alias mis à jour");
            resetForm();
          },
          onError: (err) => {
            if (err instanceof ApiError) toast.error(err.message);
            else toast.error("Erreur lors de la mise à jour de l'alias");
          },
        },
      );
    } else {
      createAlias.mutate(
        {
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          isDefault,
        },
        {
          onSuccess: () => {
            toast.success("Alias ajouté avec succès");
            resetForm();
          },
          onError: (err) => {
            if (err instanceof ApiError) toast.error(err.message);
            else toast.error("Erreur lors de la création de l'alias");
          },
        },
      );
    }
  };

  const handleDelete = (aliasId: string) => {
    deleteAlias.mutate(aliasId, {
      onSuccess: () => toast.success("Alias supprimé"),
      onError: (err) => {
        if (err instanceof ApiError) toast.error(err.message);
        else toast.error("Erreur lors de la suppression de l'alias");
      },
    });
  };

  const handleSetDefault = (alias: AccountAlias) => {
    if (alias.isDefault) return;
    updateAlias.mutate(
      {
        aliasId: alias._id,
        body: { isDefault: true },
      },
      {
        onSuccess: () => toast.success(`"${alias.email}" est désormais l'expéditeur par défaut`),
        onError: () => toast.error("Impossible de définir comme défaut"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4 text-primary" />
            Alias d'expédition ("Envoyer en tant que")
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gérez les identités d'expéditeur autorisées pour le compte {account.emailAddress}.
          </DialogDescription>
        </DialogHeader>

        {/* Adresse principale du compte */}
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Adresse principale
              </span>
              <div className="truncate text-sm font-medium">
                {account.displayName ? `${account.displayName} <${account.emailAddress}>` : account.emailAddress}
              </div>
            </div>
            {!aliases.some((a) => a.isDefault) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                <Check className="size-3" /> Par défaut
              </span>
            )}
          </div>
        </div>

        {/* Formulaire d'ajout / modification */}
        {formOpen ? (
          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border p-3 bg-card">
            <div className="font-semibold text-xs">
              {editingAlias ? "Modifier l'alias" : "Ajouter une identité d'expédition"}
            </div>
            <div className="space-y-1">
              <Label htmlFor="alias-name" className="text-xs">
                Nom d'affichage (optionnel)
              </Label>
              <Input
                id="alias-name"
                placeholder="Ex: Support HelloMail"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="alias-email" className="text-xs">
                Adresse email
              </Label>
              <Input
                id="alias-email"
                type="email"
                placeholder="alias@domaine.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="size-3.5 rounded border-input text-primary focus:ring-primary"
              />
              <span className="text-xs">Définir comme expéditeur par défaut pour ce compte</span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={resetForm} className="h-7 text-xs">
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-7 text-xs"
                disabled={createAlias.isPending || updateAlias.isPending}
              >
                {editingAlias ? "Enregistrer" : "Ajouter"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFormOpen(true)}
            className="w-full justify-center gap-1.5 h-8 text-xs"
          >
            <Plus className="size-3.5" />
            Ajouter un alias d'expédition
          </Button>
        )}

        {/* Liste des alias */}
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          <div className="text-xs font-semibold text-muted-foreground">
            Alias configurés ({aliases.length})
          </div>
          {isLoading ? (
            <div className="text-xs text-muted-foreground py-2 text-center">Chargement des alias...</div>
          ) : aliases.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2 text-center italic">
              Aucun alias configuré pour ce compte.
            </div>
          ) : (
            aliases.map((alias) => (
              <div
                key={alias._id}
                className="flex items-center justify-between gap-2 rounded-md border p-2 text-xs bg-muted/10 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium truncate">{alias.email}</span>
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
                      className="size-6 text-muted-foreground hover:text-foreground"
                      title="Définir par défaut"
                      onClick={() => handleSetDefault(alias)}
                    >
                      <Star className="size-3" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-muted-foreground hover:text-foreground"
                    title="Modifier"
                    onClick={() => startEdit(alias)}
                  >
                    <Edit2 className="size-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 text-destructive/80 hover:text-destructive"
                    title="Supprimer"
                    onClick={() => handleDelete(alias._id)}
                    disabled={deleteAlias.isPending}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
