import mongoose, { Schema, Document } from 'mongoose';

/**
 * Cache en base de la liste des dossiers IMAP d'un compte.
 *
 * Évite un `LIST` IMAP à chaque appel de `listFolders` côté API.
 * Rafraîchi par `folderService.listFolders` (TTL 5 min), par le sync worker
 * après `runInitialSyncAll`, et invalidé sur tout CRUD dossier.
 */
export interface IFolderDocument extends Document {
  accountId: mongoose.Types.ObjectId;
  path: string;
  name: string;
  delimiter: string;
  specialUse?: string;
  flags: string[];
  messages: number;
  unseen: number;
  uidNext: number;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<IFolderDocument>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    path: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    delimiter: {
      type: String,
      default: '/',
    },
    specialUse: {
      type: String,
    },
    flags: {
      type: [String],
      default: [],
    },
    messages: {
      type: Number,
      default: 0,
    },
    unseen: {
      type: Number,
      default: 0,
    },
    uidNext: {
      type: Number,
      default: 0,
    },
    syncedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

folderSchema.index({ accountId: 1, path: 1 }, { unique: true });

export const FolderModel: mongoose.Model<IFolderDocument> =
  (mongoose.models.Folder as mongoose.Model<IFolderDocument>) ||
  mongoose.model<IFolderDocument>('Folder', folderSchema);
