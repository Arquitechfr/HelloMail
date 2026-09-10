"use client";

import { useState } from "react";
import { useSendReadReceipt } from "@/lib/queries/messages";
import { Button } from "@/components/ui/button";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

interface ReadReceiptBannerProps {
  accountId: string;
  folder: string;
  uid: number;
  recipientEmail: string;
}

export function ReadReceiptBanner({
  accountId,
  folder,
  uid,
  recipientEmail,
}: ReadReceiptBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const sendReadReceipt = useSendReadReceipt(accountId);

  if (dismissed) return null;

  const handleSend = async () => {
    try {
      await sendReadReceipt.mutateAsync({ folder, uid });
      toast.success("Accusé de lecture envoyé");
      setDismissed(true);
    } catch {
      toast.error("Erreur lors de l'envoi de l'accusé de lecture");
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-primary/10 border-b border-primary/20 px-6 py-2.5 text-xs text-foreground no-print">
      <div className="flex items-center gap-2 min-w-0">
        <MailCheck className="size-4 text-primary shrink-0" />
        <span className="font-medium text-primary shrink-0">Accusé de lecture :</span>
        <span className="text-muted-foreground truncate">
          L&apos;expéditeur a demandé une confirmation de lecture ({recipientEmail}).
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="xs"
          variant="outline"
          className="h-7 text-xs border-primary/30 hover:bg-primary/10"
          onClick={handleSend}
          disabled={sendReadReceipt.isPending}
        >
          {sendReadReceipt.isPending && <Loader2 className="size-3 animate-spin mr-1" />}
          Envoyer la confirmation
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setDismissed(true)}
        >
          Ignorer
        </Button>
      </div>
    </div>
  );
}
