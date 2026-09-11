"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/stores/authStore";
import { useMe } from "@/lib/queries/auth";
import { useUnifiedStatus } from "@/lib/queries/unified";
import { useUIStore } from "@/lib/stores/uiStore";
import {
  resolveUnifiedFolders,
  UNIFIED_FOLDER_DEFINITIONS,
} from "@/lib/unified-utils";
import type { UnifiedFolderType } from "@/lib/api-types";
import { ManageUnifiedFoldersDialog } from "./ManageUnifiedFoldersDialog";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export function UnifiedFolderList() {
  const router = useRouter();
  const pathname = usePathname();
  const storeUser = useAuthStore((s) => s.user);
  const { data: meData } = useMe();
  const user = meData?.user ?? storeUser;

  const { data: status } = useUnifiedStatus();

  const { setSelectedAccount, setSelectedFolder, setMobileSidebarOpen } =
    useUIStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  const isEnabled = user?.preferences?.unifiedFoldersEnabled ?? true;
  const configuredFolders = resolveUnifiedFolders(user?.preferences?.unifiedFolders);
  const activeFolders = configuredFolders.filter((f) => f.enabled);

  if (!isEnabled || activeFolders.length === 0) {
    return null;
  }

  const handleSelect = (type: UnifiedFolderType) => {
    setSelectedAccount(null);
    setSelectedFolder(`unified:${type}`);
    setMobileSidebarOpen(false);
    router.push(`/mail/unified/${type}`);
  };

  return (
    <div className="mb-3 pb-2.5 border-b border-border/60 px-1">
      {/* En-tête de section avec bouton de configuration */}
      <div className="flex items-center justify-between px-2 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="size-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            Dossiers unifiés
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-6 text-muted-foreground hover:text-foreground"
          onClick={() => setDialogOpen(true)}
          title="Gérer les dossiers unifiés"
          aria-label="Gérer les dossiers unifiés"
        >
          <SlidersHorizontal className="size-3" />
        </Button>
      </div>

      {/* Liste des boîtes unifiées actives */}
      <div className="flex flex-col gap-0.5">
        {activeFolders.map((folder) => {
          const meta = UNIFIED_FOLDER_DEFINITIONS[folder.id];
          const Icon = meta?.icon;
          const isSelected = pathname === `/mail/unified/${folder.id}`;
          const countInfo = status ? status[folder.id] : undefined;
          const unread = countInfo?.unseen ?? 0;
          const total = countInfo?.total ?? 0;

          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => handleSelect(folder.id)}
              className={cn(
                "group flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none",
                isSelected
                  ? "bg-primary/15 text-primary font-medium shadow-2xs"
                  : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <div className="flex items-center gap-2 truncate min-w-0">
                {Icon && (
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0 transition-colors",
                      isSelected
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  />
                )}
                <span className="truncate">{folder.label || meta?.defaultLabel}</span>
              </div>

              {countInfo !== undefined && (
                <div className="flex items-center gap-1 shrink-0 ml-1.5">
                  {unread > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-bold",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-primary/20 text-primary",
                      )}
                    >
                      {unread}
                    </span>
                  ) : total > 0 ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {total}
                    </span>
                  ) : null}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <ManageUnifiedFoldersDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
