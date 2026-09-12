"use client";

import { useState, useRef, useMemo } from "react";
import type { SignatureConfig, SignatureVariables } from "@/lib/api-types";
import { formatSignatureHtml } from "@/lib/compose-utils";
import { resolveSignatureVariables, AVAILABLE_SIGNATURE_VARIABLES } from "@/lib/signature-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ImagePlus, Sparkles, Phone, Briefcase, Building2 } from "lucide-react";
import { toast } from "sonner";

interface AccountSignatureIdentityEditorProps {
  emailAddress: string;
  displayName?: string;
  signature?: SignatureConfig;
  isAlias?: boolean;
  onSave: (config: SignatureConfig) => void;
  isSaving: boolean;
}

function getDefaultSignature(displayName?: string, emailAddress?: string): string {
  const name = displayName?.trim() || emailAddress?.split("@")[0] || "";
  return `-- \nBien cordialement,\n{{prenom}} {{nom}}\n{{poste}}\n{{societe}}\n{{telephone}}\n{{email}}`;
}

export function AccountSignatureIdentityEditor({
  emailAddress,
  displayName,
  signature,
  isAlias,
  onSave,
  isSaving,
}: AccountSignatureIdentityEditorProps) {
  const [enabled, setEnabled] = useState(signature?.enabled ?? false);
  const [text, setText] = useState(
    signature?.text || (signature?.enabled ? getDefaultSignature(displayName, emailAddress) : "")
  );
  const [variables, setVariables] = useState<SignatureVariables>({
    phone: signature?.variables?.phone || "",
    jobTitle: signature?.variables?.jobTitle || "",
    company: signature?.variables?.company || "",
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToggle = (checked: boolean) => {
    setEnabled(checked);
    if (checked && !text.trim()) {
      setText(getDefaultSignature(displayName, emailAddress));
    }
  };

  const handleResetToDefault = () => {
    setText(getDefaultSignature(displayName, emailAddress));
    toast.info("Modèle par défaut avec variables inséré");
  };

  const insertVariable = (key: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => `${prev} ${key}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const updated = current.substring(0, start) + key + current.substring(end);
    setText(updated);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  };

  const handleUploadLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 250 * 1024) {
      toast.error("L'image est trop volumineuse (maximum 250 Ko)");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const imgHtml = `\n<img src="${dataUrl}" alt="Logo" style="max-height: 48px; display: block; margin-top: 8px;" />`;
      setText((prev) => `${prev}${imgHtml}`);
      toast.success("Logo inline inséré dans la signature");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const previewHtml = useMemo(() => {
    if (!enabled || !text.trim()) return "";
    const rawHtml = text.includes("<") && text.includes(">") ? text : formatSignatureHtml(text);
    return resolveSignatureVariables(rawHtml, {
      displayName,
      emailAddress,
      variables,
    });
  }, [enabled, text, displayName, emailAddress, variables]);

  const handleSubmit = () => {
    const finalText = enabled && !text.trim() ? getDefaultSignature(displayName, emailAddress) : text;
    if (enabled && !text.trim()) {
      setText(finalText);
    }

    onSave({
      enabled,
      text: finalText,
      variables,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label
          htmlFor={`sig-toggle-${emailAddress}`}
          className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none"
        >
          <input
            id={`sig-toggle-${emailAddress}`}
            type="checkbox"
            checked={enabled}
            onChange={(e) => handleToggle(e.target.checked)}
            className="size-4 accent-primary rounded cursor-pointer"
          />
          <span>{isAlias ? "Activer la signature pour cet alias" : "Activer la signature"}</span>
        </label>
        {enabled && (
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-[11px] text-primary/80 hover:text-primary underline cursor-pointer"
          >
            Modèle recommandé
          </button>
        )}
      </div>

      {enabled && (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          {/* Champs de variables dynamiques */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-muted/20 p-2.5 rounded-md border border-border/40">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Phone className="size-3" /> Téléphone
              </Label>
              <Input
                placeholder="+33 6 12 34 56 78"
                value={variables.phone || ""}
                onChange={(e) => setVariables((v) => ({ ...v, phone: e.target.value }))}
                className="h-7 text-xs bg-background/80"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Briefcase className="size-3" /> Poste / Titre
              </Label>
              <Input
                placeholder="Directeur Général"
                value={variables.jobTitle || ""}
                onChange={(e) => setVariables((v) => ({ ...v, jobTitle: e.target.value }))}
                className="h-7 text-xs bg-background/80"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3" /> Entreprise
              </Label>
              <Input
                placeholder="Acme Corp"
                value={variables.company || ""}
                onChange={(e) => setVariables((v) => ({ ...v, company: e.target.value }))}
                className="h-7 text-xs bg-background/80"
              />
            </div>
          </div>

          {/* Barre de badges de variables en 1 clic */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="size-3 text-primary" /> Insérer une variable en 1 clic
            </span>
            <div className="flex flex-wrap gap-1">
              {AVAILABLE_SIGNATURE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariable(v.key)}
                  className="inline-flex items-center rounded-md border border-border/70 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer select-none"
                  title={`Insère ${v.key} (exemple : ${v.example})`}
                >
                  + {v.label} <span className="opacity-60 font-mono ml-1">{v.key}</span>
                </button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-5 text-[10px] gap-1 px-2 border-dashed"
                title="Ajouter un logo en image inline (max 250 Ko)"
              >
                <ImagePlus className="size-3 text-primary" />
                + Logo / Image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleUploadLogo}
                className="hidden"
              />
            </div>
          </div>

          {/* Éditeur de texte */}
          <div className="flex flex-col gap-1">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`--\nBien cordialement,\n{{prenom}} {{nom}}\n{{poste}}\n{{email}}`}
              rows={5}
              className="w-full rounded-md border border-input bg-background/80 px-3 py-2 text-xs font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Aperçu interactif dynamique */}
          {previewHtml && (
            <div className="rounded border border-border/40 bg-muted/20 p-2.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                Aperçu de la signature (variables résolues)
              </span>
              <div
                className="text-xs text-foreground p-2 rounded bg-background/60 border border-border/30 overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSaving}
          className="h-7 text-xs gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Save className="size-3.5" />
          )}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
