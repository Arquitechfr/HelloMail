"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { AccountSidebar } from "@/components/mail/AccountSidebar";
import { SmartFolderMessageList } from "@/components/mail/smart/SmartFolderMessageList";
import { MessageReader } from "@/components/mail/MessageReader";
import { useUIStore } from "@/lib/stores/uiStore";
import type { Message } from "@/lib/api-types";

export default function SmartFolderPage() {
  const params = useParams<{ id: string }>();
  const smartFolderId = params.id;

  const { setSelectedAccount, setSelectedFolder, selectedUid, setSelectedUid } = useUIStore();
  const [selectedMessage, setSelectedMessage] = useState<{
    accountId: string;
    folder: string;
    uid: number;
  } | null>(null);

  useEffect(() => {
    if (selectedUid === null) {
      setSelectedMessage(null);
    }
  }, [selectedUid]);

  useEffect(() => {
    setSelectedAccount(null);
    setSelectedFolder(`smart:${smartFolderId}`);
    setSelectedMessage(null);
    setSelectedUid(null);
  }, [smartFolderId, setSelectedAccount, setSelectedFolder, setSelectedUid]);

  const handleSelectMessage = (msg: Message) => {
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
      <SmartFolderMessageList
        smartFolderId={smartFolderId}
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
