"use client";

import React, { useState } from "react";
import type { FolderInfo } from "@/lib/api-types";
import { FolderActionsMenu } from "./FolderActionsMenu";
import { FolderContextMenu } from "./FolderContextMenu";
import { useMoveMessage } from "@/lib/queries/messages";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, Folder, Inbox, Send, Trash2, FileText, Ban, Archive } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FolderNode extends FolderInfo {
  children: FolderNode[];
}

interface FolderNodeItemProps {
  node: FolderNode;
  depth: number;
  selectedFolder: string;
  accountId: string;
  accountColor?: string;
  onSelectFolder: (path: string) => void;
  onCreateSubfolder: (parent: FolderInfo) => void;
  onRename: (folder: FolderInfo) => void;
  onDelete: (folder: FolderInfo) => void;
  onImportEml: (folder: FolderInfo) => void;
  onExportMbox?: (folder: FolderInfo) => void;
  onEmpty?: (folder: FolderInfo) => void;
}

function FolderIcon({ specialUse, accountColor }: { specialUse?: string; accountColor?: string }) {
  const iconClass = "size-4 shrink-0";
  const style = accountColor ? { color: accountColor } : undefined;
  switch (specialUse) {
    case "\\Inbox":
      return <Inbox className={iconClass} style={style} />;
    case "\\Sent":
      return <Send className={iconClass} style={style} />;
    case "\\Trash":
      return <Trash2 className={iconClass} style={style} />;
    case "\\Drafts":
      return <FileText className={iconClass} style={style} />;
    case "\\Junk":
      return <Ban className={iconClass} style={style} />;
    case "\\Archive":
      return <Archive className={iconClass} style={style} />;
    default:
      return <Folder className={iconClass} style={style} />;
  }
}

export function FolderNodeItem({
  node,
  depth,
  selectedFolder,
  accountId,
  accountColor,
  onSelectFolder,
  onCreateSubfolder,
  onRename,
  onDelete,
  onImportEml,
  onExportMbox,
  onEmpty,
}: FolderNodeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [isDragOver, setIsDragOver] = useState(false);
  // Path canonique : la boîte de réception navigue toujours vers 'INBOX'
  // même si le serveur liste un nom localisé (ex. « Boîte de réception »).
  const effectivePath = node.specialUse?.toLowerCase() === "\\inbox" ? "INBOX" : node.path;
  const isSelected = effectivePath === selectedFolder;
  const hasChildren = node.children.length > 0;
  const unseen = node.status?.unseen ?? 0;
  const isNoSelect = node.flags?.includes("\\Noselect");

  const moveMessage = useMoveMessage(accountId, selectedFolder);

  const handleDrop = (e: React.DragEvent) => {
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const payload = JSON.parse(raw) as { accountId: string; folder: string; uid: number };
      if (payload.accountId === accountId && payload.folder !== effectivePath) {
        moveMessage.mutate(
          { uid: payload.uid, destination: node.path },
          {
            onSuccess: () => {
              toast.success(`Message déplacé vers « ${node.name || node.path} »`);
            },
            onError: () => {
              toast.error("Erreur lors du déplacement du message");
            },
          },
        );
      }
    } catch {
      // ignore
    }
  };

  return (
    <div>
      <FolderContextMenu
        folder={node}
        onCreateSubfolder={onCreateSubfolder}
        onRename={onRename}
        onDelete={onDelete}
        onImportEml={onImportEml}
        onExportMbox={onExportMbox}
        onEmpty={onEmpty}
      >
        <div
          className={cn(
            "group flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-all cursor-pointer select-none",
            isSelected ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/50 text-foreground/80",
            isDragOver && "ring-2 ring-primary/80 bg-primary/20 scale-[1.01] shadow-xs text-primary font-medium",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onSelectFolder(effectivePath)}
          onDragOver={(e) => {
            if (isNoSelect) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            if (isNoSelect) return;
            e.preventDefault();
            setIsDragOver(false);
            handleDrop(e);
          }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground"
            >
              {expanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
            </button>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <FolderIcon specialUse={node.specialUse} accountColor={accountColor} />
          <span className="flex-1 truncate text-xs">{node.name}</span>

          {unseen > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.2 text-[10px] font-medium text-primary-foreground group-hover:hidden">
              {unseen}
            </span>
          )}

          {/* Menu d'actions 3 boutons verticaux */}
          <FolderActionsMenu
            folder={node}
            accountId={accountId}
            onCreateSubfolder={onCreateSubfolder}
            onRename={onRename}
            onDelete={onDelete}
            onImportEml={onImportEml}
            onExportMbox={onExportMbox}
            onEmpty={onEmpty}
          />
        </div>
      </FolderContextMenu>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              accountId={accountId}
              accountColor={accountColor}
              onSelectFolder={onSelectFolder}
              onCreateSubfolder={onCreateSubfolder}
              onRename={onRename}
              onDelete={onDelete}
              onImportEml={onImportEml}
              onExportMbox={onExportMbox}
              onEmpty={onEmpty}
            />
          ))}
        </div>
      )}
    </div>
  );
}
