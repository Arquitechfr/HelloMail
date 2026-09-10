"use client";

import React, { useState } from "react";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "@/lib/queries/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag as TagIcon, Plus, Edit2, Trash2, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { MailTag } from "@/lib/api-types";

const PRESET_COLORS = [
  "#ef4444", // rouge
  "#f97316", // orange
  "#f59e0b", // ambre
  "#10b981", // émeraude
  "#06b6d4", // cyan
  "#3b82f6", // bleu
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // rose
  "#64748b", // ardoise
];

export function TagManager() {
  const { data: tagsData, isLoading } = useTags();
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();

  const [isAdding, setIsAdding] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[5]);

  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");

  const tags = tagsData?.data ?? [];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    try {
      await createTagMutation.mutateAsync({
        name: trimmed,
        color: newTagColor,
      });
      setNewTagName("");
      setIsAdding(false);
      toast.success(`Libellé « ${trimmed} » créé`);
    } catch {
      toast.error("Impossible de créer le libellé (doublon ou erreur réseau)");
    }
  };

  const startEdit = (tag: MailTag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
  };

  const cancelEdit = () => {
    setEditingTagId(null);
    setEditTagName("");
    setEditTagColor("");
  };

  const handleUpdate = async (tagId: string) => {
    const trimmed = editTagName.trim();
    if (!trimmed) return;

    try {
      await updateTagMutation.mutateAsync({
        id: tagId,
        name: trimmed,
        color: editTagColor,
      });
      cancelEdit();
      toast.success("Libellé mis à jour");
    } catch {
      toast.error("Impossible de mettre à jour le libellé");
    }
  };

  const handleDelete = async (tag: MailTag) => {
    if (!confirm(`Supprimer définitivement l'étiquette « ${tag.name} » ? Elle sera retirée de tous vos messages.`)) {
      return;
    }

    try {
      await deleteTagMutation.mutateAsync(tag.id);
      toast.success(`Libellé « ${tag.name} » supprimé`);
    } catch {
      toast.error("Impossible de supprimer le libellé");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/40 p-5 backdrop-blur-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <TagIcon className="size-4 text-primary" />
            Gestion des Libellés & Étiquettes
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organisez vos messages par catégories de couleurs personnalisées.
          </p>
        </div>
        {!isAdding && (
          <Button size="sm" onClick={() => setIsAdding(true)} className="text-xs">
            <Plus className="size-3.5 mr-1.5" />
            Nouveau libellé
          </Button>
        )}
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="mb-5 p-3.5 rounded-lg border border-border/80 bg-muted/20 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              type="text"
              autoFocus
              placeholder="Ex: Factures, Urgent, Projets..."
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              maxLength={50}
              className="h-8 text-xs max-w-sm"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newTagName.trim() || createTagMutation.isPending}
              className="text-xs h-8"
            >
              {createTagMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Enregistrer"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              className="text-xs h-8"
            >
              Annuler
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Couleur :</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    newTagColor === c ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          Chargement des libellés...
        </div>
      ) : tags.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border/60 rounded-lg text-xs text-muted-foreground">
          Aucun libellé créé. Cliquez sur « Nouveau libellé » pour en ajouter un.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {tags.map((tag) => {
            const isEditing = editingTagId === tag.id;

            if (isEditing) {
              return (
                <div
                  key={tag.id}
                  className="flex flex-col gap-2 p-2.5 rounded-lg border border-primary/50 bg-accent/30"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      maxLength={50}
                      className="h-7 text-xs flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleUpdate(tag.id)}
                      disabled={!editTagName.trim() || updateTagMutation.isPending}
                      title="Valider"
                    >
                      <Check className="size-3.5 text-primary" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={cancelEdit}
                      title="Annuler"
                    >
                      <X className="size-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditTagColor(c)}
                        className={`w-4 h-4 rounded-full transition-transform ${
                          editTagColor === c ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c }}
                        aria-label={`Couleur ${c}`}
                      />
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-xs font-medium text-foreground truncate">
                    {tag.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => startEdit(tag)}
                    title="Modifier"
                  >
                    <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => handleDelete(tag)}
                    title="Supprimer"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
