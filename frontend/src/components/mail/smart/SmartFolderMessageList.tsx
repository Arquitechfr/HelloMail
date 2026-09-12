"use client";

import { useRef, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useSmartFolderMessages } from "@/lib/queries/smartFolders";
import { useAccounts } from "@/lib/queries/accounts";
import { useUIStore } from "@/lib/stores/uiStore";
import { MessageListItem } from "@/components/mail/MessageListItem";
import { QuickFilterBar, type QuickFilter } from "@/components/mail/QuickFilterBar";
import { useListNavigationShortcuts } from "@/lib/hooks/useListNavigationShortcuts";
import { SMART_FOLDER_ICONS, SmartFolderDialog } from "./SmartFolderDialog";
import type { Message, SmartFolder } from "@/lib/api-types";
import { Loader2, Sparkles, Edit2, ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SmartFolderMessageListProps {
  smartFolderId: string;
  selectedMessage: { accountId: string; folder: string; uid: number } | null;
  onSelectMessage: (msg: Message) => void;
}

export function SmartFolderMessageList({
  smartFolderId,
  selectedMessage,
  onSelectMessage,
}: SmartFolderMessageListProps) {
  const { data: accounts } = useAccounts();
  const accountMap = useMemo(() => {
    const map: Record<string, { color?: string; emailAddress: string }> = {};
    accounts?.forEach((acc) => {
      map[acc._id] = { color: acc.color, emailAddress: acc.emailAddress };
    });
    return map;
  }, [accounts]);

  const { data, isLoading, isFetching } = useSmartFolderMessages(smartFolderId, 1, 100);

  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const messages = data?.data ?? [];
  const smartFolder: SmartFolder | undefined = data?.smartFolder;

  const filteredMessages = useMemo(() => {
    switch (quickFilter) {
      case "unread":
        return messages.filter((m) => !m.flags.seen);
      case "pinned":
        return messages.filter((m) => m.isPinned);
      case "attachments":
        return messages.filter((m) => m.hasAttachments);
      default:
        return messages;
    }
  }, [messages, quickFilter]);

  const filterCounts = useMemo(
    () => ({
      all: messages.length,
      unread: messages.filter((m) => !m.flags.seen).length,
      pinned: messages.filter((m) => m.isPinned).length,
      attachments: messages.filter((m) => m.hasAttachments).length,
    }),
    [messages],
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const handleSelectUid = (uid: number | null) => {
    if (uid === null) {
      useUIStore.getState().setSelectedUid(null);
    } else {
      const targetMsg = filteredMessages.find((m) => m.uid === uid);
      if (targetMsg) {
        onSelectMessage(targetMsg);
      }
    }
  };

  const { visibleUids, handleSelectAll } = useListNavigationShortcuts({
    items: filteredMessages,
    selectedUid: selectedMessage?.uid ?? null,
    onSelectUid: handleSelectUid,
  });

  const IconComponent =
    (smartFolder?.icon && SMART_FOLDER_ICONS[smartFolder.icon]) || Sparkles;

  return (
    <aside
      aria-label="Liste des messages du dossier intelligent"
      className={cn(
        "flex h-full flex-col border-r border-border bg-card w-full lg:w-80 lg:shrink-0 xl:w-96",
        selectedMessage ? "hidden lg:flex" : "flex",
      )}
    >
      {/* En-tête du dossier intelligent */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon-xs"
            className="lg:hidden shrink-0 size-7"
            onClick={() => useUIStore.getState().setMobileSidebarOpen(true)}
            aria-label="Ouvrir le menu latéral"
          >
            <ArrowLeft className="size-4" />
          </Button>

          <div
            className="flex size-7 items-center justify-center rounded-md shrink-0 shadow-2xs"
            style={{
              backgroundColor: smartFolder?.color ? `${smartFolder.color}20` : undefined,
              color: smartFolder?.color || "#3b82f6",
            }}
          >
            <IconComponent className="size-4" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xs font-semibold text-foreground truncate">
              {smartFolder?.name || "Dossier intelligent"}
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="font-mono bg-muted/60 px-1 py-0.2 rounded truncate max-w-[140px]">
                {smartFolder?.query}
              </span>
              <span>•</span>
              <span>{data?.total ?? messages.length}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isFetching && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {smartFolder && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={() => setEditDialogOpen(true)}
              title="Modifier ce dossier intelligent"
            >
              <Edit2 className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Barre de filtres rapides */}
      <QuickFilterBar
        currentFilter={quickFilter}
        counts={filterCounts}
        onFilterChange={setQuickFilter}
      />

      {/* Liste virtualisée */}
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center p-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground mb-2">
              <Inbox className="size-5" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">
              Aucun message correspondant
            </p>
            <p className="text-[11px] text-muted-foreground/70 mt-1 max-w-[200px]">
              Les messages apparaîtront dès qu'ils répondront aux critères de la requête.
            </p>
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const msg = filteredMessages[virtualItem.index];
              const isSelected = selectedMessage?.uid === msg.uid;
              const acc = accountMap[msg.accountId];

              return (
                <div
                  key={`${msg.accountId}-${msg.folder}-${msg.uid}`}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <MessageListItem
                    message={msg}
                    accountId={msg.accountId}
                    folder={msg.folder}
                    isSelected={isSelected}
                    accountColor={acc?.color}
                    onSelect={() => onSelectMessage(msg)}
                    allVisibleUids={visibleUids}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialogue de modification du dossier */}
      {smartFolder && (
        <SmartFolderDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          folderToEdit={smartFolder}
        />
      )}
    </aside>
  );
}
