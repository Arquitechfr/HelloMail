"use client";

import { useState } from "react";
import { useFolders } from "@/lib/queries/folders";
import { cn } from "@/lib/utils";
import type { FolderInfo } from "@/lib/api-types";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Star,
  Archive,
  Folder as FolderIconBase,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface FolderTreeProps {
  accountId: string;
  selectedFolder: string;
  onSelectFolder: (path: string) => void;
}

/** Icône selon le specialUse du dossier. */
function folderIconType(specialUse?: string) {
  switch (specialUse) {
    case "\\Inbox":
      return "inbox" as const;
    case "\\Sent":
      return "sent" as const;
    case "\\Drafts":
      return "drafts" as const;
    case "\\Trash":
      return "trash" as const;
    case "\\Junk":
      return "junk" as const;
    case "\\Flagged":
      return "flagged" as const;
    case "\\Archive":
      return "archive" as const;
    default:
      return "folder" as const;
  }
}

const iconMap = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  trash: Trash2,
  junk: Star,
  flagged: Star,
  archive: Archive,
  folder: FolderIconBase,
} as const;

function FolderIcon({ specialUse }: { specialUse?: string }) {
  const Icon = iconMap[folderIconType(specialUse)];
  return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

/** Construit une arborescence à partir de la liste plate des dossiers. */
function buildTree(folders: FolderInfo[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const f of folders) {
    map.set(f.path, { ...f, children: [] });
  }

  for (const f of folders) {
    const node = map.get(f.path)!;
    const delimiter = f.delimiter || "/";
    const parentPath = f.path.includes(delimiter)
      ? f.path.substring(0, f.path.lastIndexOf(delimiter))
      : "";

    if (parentPath && map.has(parentPath)) {
      map.get(parentPath)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

interface FolderNode extends FolderInfo {
  children: FolderNode[];
}

function FolderNodeItem({
  node,
  depth,
  selectedFolder,
  onSelectFolder,
}: {
  node: FolderNode;
  depth: number;
  selectedFolder: string;
  onSelectFolder: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isSelected = node.path === selectedFolder;
  const hasChildren = node.children.length > 0;
  const unseen = node.status?.unseen ?? 0;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm transition-colors cursor-pointer",
          isSelected ? "bg-primary/15 text-primary font-medium" : "hover:bg-muted/50",
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
            className="shrink-0"
          >
            {expanded ? (
              <ChevronDown className="size-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-3.5 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <FolderIcon specialUse={node.specialUse} />
        <span className="flex-1 truncate">{node.name}</span>
        {unseen > 0 && (
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
            {unseen}
          </span>
        )}
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedFolder={selectedFolder}
              onSelectFolder={onSelectFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ accountId, selectedFolder, onSelectFolder }: FolderTreeProps) {
  const { data: folders, isLoading, error } = useFolders(accountId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Impossible de charger les dossiers
      </div>
    );
  }

  if (!folders || folders.length === 0) {
    return <div className="p-3 text-sm text-muted-foreground">Aucun dossier</div>;
  }

  const tree = buildTree(folders);

  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node) => (
        <FolderNodeItem
          key={node.path}
          node={node}
          depth={0}
          selectedFolder={selectedFolder}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  );
}
