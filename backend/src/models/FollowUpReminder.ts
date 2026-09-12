import mongoose, { Schema, Document } from 'mongoose';

export type FollowUpReminderStatus =
  | 'pending'
  | 'triggered'
  | 'replied'
  | 'dismissed'
  | 'cancelled';

export interface IFollowUpReminderDocument extends Document {
  userId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  messageId?: string;
  folder: string;
  uid: number;
  threadSubject: string;
  targetRecipient: string;
  remindAt: Date;
  note?: string;
  status: FollowUpReminderStatus;
  triggeredAt?: Date;
  repliedAt?: Date;
  dismissedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const followUpReminderSchema = new Schema<IFollowUpReminderDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: true,
      index: true,
    },
    messageId: {
      type: String,
      trim: true,
    },
    folder: {
      type: String,
      required: true,
      trim: true,
    },
    uid: {
      type: Number,
      required: true,
    },
    threadSubject: {
      type: String,
      required: true,
      default: '',
      trim: true,
    },
    targetRecipient: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    remindAt: {
      type: Date,
      required: true,
      index: true,
    },
    note: {
      type: String,
      maxlength: 500,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'triggered', 'replied', 'dismissed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    triggeredAt: {
      type: Date,
    },
    repliedAt: {
      type: Date,
    },
    dismissedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Index composé pour l'exécution efficace par le worker runner
followUpReminderSchema.index({ status: 1, remindAt: 1 });

// Index pour les requêtes de listing par compte et statut
followUpReminderSchema.index({ accountId: 1, status: 1, remindAt: 1 });

// Index pour la recherche rapide par message
followUpReminderSchema.index({ accountId: 1, folder: 1, uid: 1 });
followUpReminderSchema.index({ accountId: 1, messageId: 1 });

// Index pour les métriques utilisateur globales
followUpReminderSchema.index({ userId: 1, status: 1 });

export const FollowUpReminderModel: mongoose.Model<IFollowUpReminderDocument> =
  (mongoose.models.FollowUpReminder as mongoose.Model<IFollowUpReminderDocument>) ||
  mongoose.model<IFollowUpReminderDocument>('FollowUpReminder', followUpReminderSchema);
