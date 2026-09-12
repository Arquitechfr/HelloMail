export type ProfileSectionKey =
  | 'preferences'
  | 'tags'
  | 'rules'
  | 'templates'
  | 'smartFolders'
  | 'contacts'
  | 'senderLists'
  | 'signatures';

export interface IProfilePreviewSummaryItem {
  total: number;
  existing: number;
  new: number;
}

export interface IProfilePreviewResult {
  isEncrypted: boolean;
  metadata: {
    version: string;
    generator: string;
    exportedAt: string;
    userEmail: string;
  };
  summary: {
    tags: IProfilePreviewSummaryItem;
    rules: IProfilePreviewSummaryItem;
    templates: IProfilePreviewSummaryItem;
    smartFolders: IProfilePreviewSummaryItem;
    contacts: IProfilePreviewSummaryItem;
    senderLists: IProfilePreviewSummaryItem;
    signatures: { total: number; matchingAccounts: number };
    hasPreferences: boolean;
  };
}

export interface IRestoreReport {
  imported: Record<string, number>;
  updated: Record<string, number>;
  skipped: Record<string, number>;
}

export interface IRestoreProfileInput {
  backupData: unknown;
  password?: string;
  sections: ProfileSectionKey[];
  conflictStrategy: 'skip' | 'overwrite';
}
