export type ExportFormat = "zip" | "mbox";

export interface ExportProgressPayload {
  exportId?: string;
  folder?: string;
  currentFolder?: string;
  current?: number;
  total?: number;
  folderIndex?: number;
  totalFolders?: number;
  totalExportedMessages?: number;
  percentage: number;
}
