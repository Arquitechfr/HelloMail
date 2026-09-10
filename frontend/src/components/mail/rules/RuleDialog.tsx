"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RuleForm } from "./RuleForm";
import type { MailRule } from "@/lib/api-types";

interface RuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ruleToEdit?: MailRule | null;
}

export function RuleDialog({ open, onOpenChange, ruleToEdit }: RuleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-6 border-border bg-popover shadow-xl">
        {open && (
          <RuleForm
            key={ruleToEdit?._id ?? "new"}
            ruleToEdit={ruleToEdit}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
