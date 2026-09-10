"use client";

import React, { useState } from "react";
import {
  useTemplates,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/lib/queries/templates";
import { useAccounts } from "@/lib/queries/accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { EmailTemplate } from "@/lib/types/templates";

export function TemplateManager() {
  const { data: templatesData, isLoading } = useTemplates();
  const { data: accounts } = useAccounts();
  const createTemplateMutation = useCreateTemplate();
  const updateTemplateMutation = useUpdateTemplate();
  const deleteTemplateMutation = useDeleteTemplate();

  const [isAdding, setIsAdding] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [accountId, setAccountId] = useState<string>("");

  const templates = templatesData?.data ?? [];

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setBodyHtml("");
    setShortcut("");
    setAccountId("");
    setIsAdding(false);
    setEditingTemplateId(null);
  };

  const startCreate = () => {
    resetForm();
    setIsAdding(true);
  };

  const startEdit = (tpl: EmailTemplate) => {
    setTitle(tpl.title);
    setSubject(tpl.subject || "");
    setBodyHtml(tpl.bodyHtml);
    setShortcut(tpl.shortcut || "");
    setAccountId(tpl.accountId || "");
    setEditingTemplateId(tpl.id);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !bodyHtml.trim()) {
      toast.error("Le titre et le corps du modèle sont requis");
      return;
    }

    try {
      if (editingTemplateId) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplateId,
          title: title.trim(),
          subject: subject.trim() || undefined,
          bodyHtml: bodyHtml.trim(),
          shortcut: shortcut.trim() || null,
          accountId: accountId || null,
        });
        toast.success(`Modèle « ${title} » mis à jour`);
      } else {
        await createTemplateMutation.mutateAsync({
          title: title.trim(),
          subject: subject.trim() || undefined,
          bodyHtml: bodyHtml.trim(),
          shortcut: shortcut.trim() || undefined,
          accountId: accountId || null,
        });
        toast.success(`Modèle « ${title} » créé`);
      }
      resetForm();
    } catch {
      toast.error("Une erreur est survenue lors de l'enregistrement");
    }
  };

  const handleDelete = async (tpl: EmailTemplate) => {
    if (!confirm(`Supprimer le modèle « ${tpl.title} » ?`)) return;
    try {
      await deleteTemplateMutation.mutateAsync(tpl.id);
      toast.success("Modèle supprimé");
    } catch {
      toast.error("Impossible de supprimer le modèle");
    }
  };

  const isFormOpen = isAdding || editingTemplateId !== null;

  return (
    <div className="rounded-md border border-border bg-card/60 p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="text-sm font-bold font-display text-foreground">
            Modèles d&apos;emails & Réponses types
          </h2>
        </div>
        {!isFormOpen && (
          <Button
            size="sm"
            onClick={startCreate}
            className="text-xs h-8 gap-1.5 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Nouveau modèle</span>
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Créez des textes types pour répondre rapidement à vos correspondants en 1 clic
        ou via des raccourcis clavier (ex: <code className="text-primary font-mono">!merci</code>).
      </p>

      {/* Formulaire d'ajout / modification */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="mb-5 p-4 rounded-lg border border-primary/20 bg-primary/5 flex flex-col gap-3.5 animate-in fade-in-0 duration-150"
        >
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold text-foreground">
              {editingTemplateId ? "Modifier le modèle" : "Créer un nouveau modèle"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={resetForm}
              className="cursor-pointer"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nom du modèle *</Label>
              <Input
                placeholder="Ex: Remerciement candidature"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Raccourci d&apos;insertion rapide</Label>
              <Input
                placeholder="Ex: !merci"
                value={shortcut}
                onChange={(e) => setShortcut(e.target.value)}
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Objet de l&apos;email (optionnel)</Label>
              <Input
                placeholder="Préremplir l'objet si vide..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Compte associé</Label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Tous les comptes (Global)</option>
                {accounts?.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.emailAddress} {acc.displayName ? `(${acc.displayName})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Corps du message *</Label>
            <textarea
              placeholder="Saisissez le texte du modèle..."
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetForm}
              className="text-xs h-7.5 cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              className="text-xs h-7.5 gap-1.5 cursor-pointer"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              <span>Enregistrer</span>
            </Button>
          </div>
        </form>
      )}

      {/* Liste des modèles */}
      {isLoading ? (
        <div className="flex items-center justify-center p-6 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin mr-2" />
          Chargement des modèles...
        </div>
      ) : templates.length === 0 ? (
        <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/80 rounded-lg">
          <FileText className="size-6 mx-auto mb-2 opacity-50" />
          Aucun modèle configuré. Cliquez sur « Nouveau modèle » pour commencer.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 transition-colors"
            >
              <div className="flex flex-col gap-0.5 min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {tpl.title}
                  </span>
                  {tpl.shortcut && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {tpl.shortcut}
                    </span>
                  )}
                  {tpl.isPreset && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 shrink-0">
                      Prédéfini
                    </span>
                  )}
                  {tpl.accountId ? (
                    <span className="text-[10px] text-muted-foreground border border-border px-1.5 py-0.2 rounded shrink-0">
                      Compte spécifique
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70 bg-muted px-1.5 py-0.2 rounded shrink-0">
                      Global
                    </span>
                  )}
                </div>
                {tpl.subject && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    Objet : {tpl.subject}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground line-clamp-1 opacity-80">
                  {tpl.bodyText}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => startEdit(tpl)}
                  title="Modifier ce modèle"
                  className="cursor-pointer"
                >
                  <Edit2 className="size-3.5 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleDelete(tpl)}
                  title="Supprimer ce modèle"
                  className="cursor-pointer"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
