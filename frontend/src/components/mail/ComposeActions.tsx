"use client";

import { Button } from "@/components/ui/button";
import { Loader2, Send, Save, X } from "lucide-react";
import { TemplateInsertDropdown } from "@/components/mail/TemplateInsertDropdown";
import type { EmailTemplate } from "@/lib/types/templates";

interface ComposeActionsProps {
  submitting: boolean;
  savingDraft: boolean;
  requestReadReceipt: boolean;
  onRequestReadReceiptChange: (checked: boolean) => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  accountId?: string;
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export function ComposeActions({
  submitting,
  savingDraft,
  requestReadReceipt,
  onRequestReadReceiptChange,
  onSaveDraft,
  onCancel,
  accountId,
  onSelectTemplate,
}: ComposeActionsProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={submitting} className="cursor-pointer">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Envoyer
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={savingDraft || submitting}
          className="cursor-pointer"
        >
          {savingDraft ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Enregistrer
        </Button>
        {onSelectTemplate && (
          <TemplateInsertDropdown
            accountId={accountId}
            onSelectTemplate={onSelectTemplate}
            variant="button"
          />
        )}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={requestReadReceipt}
            onChange={(e) => onRequestReadReceiptChange(e.target.checked)}
            className="rounded border-border size-3.5 accent-primary cursor-pointer"
          />
          <span>Accusé de lecture</span>
        </label>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={submitting || savingDraft}
          className="cursor-pointer"
        >
          <X className="size-4" />
          Annuler
        </Button>
      </div>
    </div>
  );
}
