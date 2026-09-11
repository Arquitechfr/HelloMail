"use client";

import { useState } from "react";
import type { UnsubscribeInfo } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { MailX } from "lucide-react";
import { UnsubscribeDialog } from "./UnsubscribeDialog";

export interface UnsubscribeButtonProps {
  accountId: string;
  folder: string;
  uid: number;
  info: UnsubscribeInfo;
}

export function UnsubscribeButton({
  accountId,
  folder,
  uid,
  info,
}: UnsubscribeButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);

  if (isUnsubscribed) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
        <MailX className="size-3 text-muted-foreground" />
        Désabonné
      </span>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md gap-1"
        title="Se désabonner de cette liste de diffusion"
      >
        <MailX className="size-3 text-muted-foreground" />
        <span>Se désabonner</span>
      </Button>

      <UnsubscribeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accountId={accountId}
        folder={folder}
        uid={uid}
        info={info}
        onSuccess={() => setIsUnsubscribed(true)}
      />
    </>
  );
}
