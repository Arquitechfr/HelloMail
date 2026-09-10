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
      <DialogContent className="w-[96vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 md:p-8 border-border bg-popover/98 backdrop-blur-md shadow-2xl">
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
