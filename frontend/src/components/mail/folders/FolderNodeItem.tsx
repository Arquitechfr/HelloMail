"use client";

import React, { useState } from "react";
import type { FolderInfo } from "@/lib/api-types";
import { FolderActionsMenu } from "./FolderActionsMenu";
import { FolderContextMenu } from "./FolderContextMenu";
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
  onSelectFolder: (path: string) => void;
  onCreateSubfolder: (parent: FolderInfo) => void;
  onRename: (folder: FolderInfo) => void;
  onDelete: (folder: FolderInfo) => void;
}

function FolderIcon({ specialUse }: { specialUse?: string }) {
  const iconClass = "size-4 shrink-0 text-muted-foreground";
  switch (specialUse) {
    case "\\Inbox":
      return <Inbox className={iconClass} />;
    case "\\Sent":
      return <Send className={iconClass} />;
    case "\\Trash":
      return <Trash2 className={iconClass} />;
    case "\\Drafts":
      return <FileText className={iconClass} />;
    case "\\Junk":
      return <Ban className={iconClass} />;
    case "\\Archive":
      return <Archive className={iconClass} />;
    default:
      return <Folder className={iconClass} />;
  }
}

export function FolderNodeItem({
  node,
  depth,
  selectedFolder,
  accountId,
  onSelectFolder,
  onCreateSubfolder,
  onRename,
  onDelete,
}: FolderNodeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = node.path === selectedFolder;
  const hasChildren = node.children.length > 0;
  const unseen = node.status?.unseen ?? 0;

  return (
    <div>
      <FolderContextMenu
        folder={node}
        onCreateSubfolder={onCreateSubfolder}
        onRename={onRename}
        onDelete={onDelete}
      >
        <div
          className={cn(
            "group flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm transition-colors cursor-pointer select-none",
            isSelected ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/50 text-foreground/80",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => onSelectFolder(node.path)}
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
          <FolderIcon specialUse={node.specialUse} />
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
              onSelectFolder={onSelectFolder}
              onCreateSubfolder={onCreateSubfolder}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
