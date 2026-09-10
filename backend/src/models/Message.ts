import mongoose, { Schema, Document } from 'mongoose';

export interface MessageAddress {
  name?: string;
  address: string;
}

export interface MessageFlags {
  seen: boolean;
  answered: boolean;
  flagged: boolean;
}

export interface IMessageDocument extends Document {
  accountId: mongoose.Types.ObjectId;
  folder: string;
  uid: number;
  messageId?: string;
  inReplyTo?: string;
  subject: string;
  from: MessageAddress;
  to: MessageAddress[];
  date: Date;
  flags: MessageFlags;
  hasAttachments: boolean;
  size: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const messageAddressSchema = new Schema<MessageAddress>(
  {
    name: { type: String, trim: true },
    address: { type: String, required: true, trim: true, lowercase: true },
  },
  { _id: false },
);

const messageFlagsSchema = new Schema<MessageFlags>(
  {
    seen: { type: Boolean, default: false },
    answered: { type: Boolean, default: false },
    flagged: { type: Boolean, default: false },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessageDocument>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    folder: {
      type: String,
      required: true,
      default: 'INBOX',
    },
    uid: {
      type: Number,
      required: true,
    },
    messageId: {
      type: String,
      trim: true,
    },
    inReplyTo: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      default: '',
    },
    from: {
      type: messageAddressSchema,
      required: true,
    },
    to: {
      type: [messageAddressSchema],
      default: [],
    },
    date: {
      type: Date,
      required: true,
    },
    flags: {
      type: messageFlagsSchema,
      default: () => ({ seen: false, answered: false, flagged: false }),
    },
    hasAttachments: {
      type: Boolean,
      default: false,
    },
    size: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Index unique composé : empêche les doublons sur resync.
messageSchema.index({ accountId: 1, folder: 1, uid: 1 }, { unique: true });

// Index pour filtrage par tag
messageSchema.index({ accountId: 1, tags: 1 });

// Index pour le tri de la liste par date décroissante.
messageSchema.index({ accountId: 1, date: -1 });

// Index pour la liste paginée par dossier (optimise find({accountId, folder}).sort({date: -1})).
messageSchema.index({ accountId: 1, folder: 1, date: -1 });

// Index pour le regroupement de conversation / threading.
messageSchema.index({ accountId: 1, messageId: 1 });
messageSchema.index({ accountId: 1, inReplyTo: 1 });

// Index textuel pour la recherche plein texte (subject + from + to).
// Poids : subject (3) > from (2) > to (1) pour prioriser le sujet dans le score.
messageSchema.index(
  { subject: 'text', 'from.address': 'text', 'to.address': 'text' },
  { name: 'message_text_search', weights: { subject: 3, 'from.address': 2, 'to.address': 1 } },
);

export const MessageModel: mongoose.Model<IMessageDocument> =
  (mongoose.models.Message as mongoose.Model<IMessageDocument>) ||
  mongoose.model<IMessageDocument>('Message', messageSchema);
