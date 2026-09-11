"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { UnifiedMessageList } from "@/components/mail/unified/UnifiedMessageList";
import { MessageReader } from "@/components/mail/MessageReader";
import { useUIStore } from "@/lib/stores/uiStore";
import { ALL_UNIFIED_TYPES } from "@/lib/unified-utils";
import type { UnifiedFolderType, Message } from "@/lib/api-types";

export default function UnifiedFolderPage() {
  const params = useParams<{ type: string }>();
  const rawType = params.type as UnifiedFolderType;
  const type: UnifiedFolderType = ALL_UNIFIED_TYPES.includes(rawType)
    ? rawType
    : "inbox";

  const { setSelectedAccount, setSelectedFolder, selectedUid, setSelectedUid } = useUIStore();
  const [selectedMessage, setSelectedMessage] = useState<{
    accountId: string;
    folder: string;
    uid: number;
  } | null>(null);

  // Synchronise selectedMessage si selectedUid est réinitialisé (ex: clic sur ArrowLeft retour)
  useEffect(() => {
    if (selectedUid === null) {
      setSelectedMessage(null);
    }
  }, [selectedUid]);

  useEffect(() => {
    setSelectedAccount(null);
    setSelectedFolder(`unified:${type}`);
    setSelectedMessage(null);
    setSelectedUid(null);
  }, [type, setSelectedAccount, setSelectedFolder, setSelectedUid]);

  const handleSelectMessage = (
    msg: Message & { accountId: string; folder: string },
  ) => {
    setSelectedMessage({
      accountId: msg.accountId,
      folder: msg.folder,
      uid: msg.uid,
    });
    setSelectedUid(msg.uid);
  };

  return (
    <>
      <AccountSidebar />
      <UnifiedMessageList
        type={type}
        selectedMessage={selectedMessage}
        onSelectMessage={handleSelectMessage}
      />
      {selectedMessage ? (
        <MessageReader
          key={`${selectedMessage.accountId}-${selectedMessage.folder}-${selectedMessage.uid}`}
          accountId={selectedMessage.accountId}
          folder={selectedMessage.folder}
          uid={selectedMessage.uid}
        />
      ) : (
        <MessageReader accountId="" folder="" uid={null} />
      )}
    </>
  );
}
