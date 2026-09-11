import mongoose, { Schema, Document } from 'mongoose';

export interface IScheduledAttachment {
  filename: string;
  content: string; // base64
  contentType?: string;
  size?: number;
}

export interface IScheduledPayload {
  from?: {
    name?: string;
    address: string;
  };
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: IScheduledAttachment[];
  inReplyTo?: string;
  references?: string[];
  requestReadReceipt?: boolean;
}

export type ScheduledStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface IScheduledMessageDocument extends Document {
  userId: mongoose.Types.ObjectId;
  accountId: mongoose.Types.ObjectId;
  payload: IScheduledPayload;
  scheduledAt: Date;
  status: ScheduledStatus;
  attempts: number;
  sentAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scheduledMessageSchema = new Schema<IScheduledMessageDocument>(
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
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'sent', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    sentAt: {
      type: Date,
    },
    errorMessage: {
      type: String,
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

// Index composé pour l'exécution efficace par le worker
scheduledMessageSchema.index({ scheduledAt: 1, status: 1 });
// Index pour la liste utilisateur
scheduledMessageSchema.index({ userId: 1, accountId: 1, status: 1 });

export const ScheduledMessageModel: mongoose.Model<IScheduledMessageDocument> =
  (mongoose.models.ScheduledMessage as mongoose.Model<IScheduledMessageDocument>) ||
  mongoose.model<IScheduledMessageDocument>('ScheduledMessage', scheduledMessageSchema);
