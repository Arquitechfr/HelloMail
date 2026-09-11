import mongoose, { Schema, Document } from 'mongoose';

/**
 * État de synchronisation d'un dossier (CONDSTORE / QRESYNC delta).
 *
 * Persiste `uidValidity` et `highestModseq` par (accountId, folder) pour
 * permettre une resync incrémentale à la reconnexion : au lieu de re-fetcher
 * les N derniers messages, on ne rapatrie que les changements via
 * `fetch('1:*', { changedSince: highestModseq })`.
 *
 * `highestModseq` est stocké en string (valeur BigInt côté ImapFlow).
 */
export interface IFolderSyncStateDocument extends Document {
  accountId: mongoose.Types.ObjectId;
  folder: string;
  uidValidity: string;
  highestModseq?: string;
  lastSyncAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const folderSyncStateSchema = new Schema<IFolderSyncStateDocument>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
    },
    folder: {
      type: String,
      required: true,
    },
    uidValidity: {
      type: String,
      required: true,
    },
    highestModseq: {
      type: String,
    },
    lastSyncAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

folderSyncStateSchema.index({ accountId: 1, folder: 1 }, { unique: true });

export const FolderSyncStateModel: mongoose.Model<IFolderSyncStateDocument> =
  (mongoose.models.FolderSyncState as mongoose.Model<IFolderSyncStateDocument>) ||
  mongoose.model<IFolderSyncStateDocument>('FolderSyncState', folderSyncStateSchema);
