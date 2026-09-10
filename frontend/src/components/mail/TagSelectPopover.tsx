"use client";

import React, { useState, useRef, useEffect } from "react";
import { Tag as TagIcon, Check, Plus, Loader2 } from "lucide-react";
import { useTags, useCreateTag, useSetMessageTags } from "@/lib/queries/tags";
import { toast } from "sonner";

interface TagSelectPopoverProps {
  accountId: string;
  folder: string;
  uid: number;
  currentTags?: string[];
  triggerClassName?: string;
  size?: "sm" | "default";
}

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

export function TagSelectPopover({
  accountId,
  folder,
  uid,
  currentTags = [],
  triggerClassName = "",
  size = "default",
}: TagSelectPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[5]);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: tagsData, isLoading } = useTags();
  const createTagMutation = useCreateTag();
  const setTagsMutation = useSetMessageTags();

  const tags = tagsData?.data ?? [];

  // Ferme le popover au clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsCreating(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleTag = async (tagName: string) => {
    const exists = currentTags.includes(tagName);
    const nextTags = exists
      ? currentTags.filter((t) => t !== tagName)
      : [...currentTags, tagName];

    try {
      await setTagsMutation.mutateAsync({
        accountId,
        folder,
        uid,
        tags: nextTags,
      });
    } catch {
      toast.error("Impossible de modifier les étiquettes");
    }
  };

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    try {
      const created = await createTagMutation.mutateAsync({
        name: trimmed,
        color: selectedColor,
      });
      // Applique immédiatement la nouvelle étiquette au message
      await setTagsMutation.mutateAsync({
        accountId,
        folder,
        uid,
        tags: [...currentTags, created.data.name],
      });
      setNewTagName("");
      setIsCreating(false);
      toast.success(`Étiquette « ${created.data.name} » créée et appliquée`);
    } catch {
      toast.error("Impossible de créer l'étiquette");
    }
  };

  const isSm = size === "sm";

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/60 hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-all duration-200 ${
          isSm ? "p-1.5 text-xs" : "px-2.5 py-1.5 text-xs font-medium"
        } ${triggerClassName}`}
        title="Gérer les étiquettes"
        aria-expanded={isOpen}
      >
        <TagIcon className={isSm ? "w-3.5 h-3.5" : "w-4 h-4"} />
        {!isSm && <span>Étiquettes</span>}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-xl p-2.5 shadow-2xl z-50 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
            <span className="text-xs font-semibold text-foreground">Étiquettes</span>
            {setTagsMutation.isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>

          {isLoading ? (
            <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Chargement...
            </div>
          ) : tags.length === 0 && !isCreating ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Aucune étiquette définie
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1 py-1">
              {tags.map((tag) => {
                const isSelected = currentTags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-accent/60 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate text-foreground font-medium">
                        {tag.name}
                      </span>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {isCreating ? (
            <form onSubmit={handleCreateTag} className="pt-2 border-t border-border/60 mt-1 space-y-2">
              <input
                type="text"
                autoFocus
                placeholder="Nom de l'étiquette..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                maxLength={50}
                className="w-full px-2.5 py-1 text-xs rounded-md border border-border bg-input/40 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-4 h-4 rounded-full transition-transform ${
                      selectedColor === color ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Couleur ${color}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-2 py-1 text-[11px] rounded text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Créer
                </button>
              </div>
            </form>
          ) : (
            <div className="pt-1.5 border-t border-border/60 mt-1">
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 rounded-md transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle étiquette</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
