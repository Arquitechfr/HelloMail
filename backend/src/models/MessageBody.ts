import mongoose, { Schema, Document } from 'mongoose';

/**
 * Cache des corps de messages (text/plain + text/html déjà sanitizé).
 *
 * Évite de re-télécharger les parties MIME à chaque ouverture d'un email.
 * Un document par (accountId, folder, uid) ; TTL 30 jours sur `fetchedAt`
 * pour la rétention automatique. Les flags/envelope ne sont PAS cachés
 * (fraîcheur via le fetchOne léger dans messageFetchService).
 */
export interface IMessageBodyDocument extends Document {
  accountId: mongoose.Types.ObjectId;
  folder: string;
  uid: number;
  text?: string;
  html?: string;
  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageBodySchema = new Schema<IMessageBodyDocument>(
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
    },
    uid: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
    },
    html: {
      type: String,
    },
    fetchedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

messageBodySchema.index({ accountId: 1, folder: 1, uid: 1 }, { unique: true });
// Rétention automatique : les corps sont expirés 30 jours après leur mise en cache.
messageBodySchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export const MessageBodyModel: mongoose.Model<IMessageBodyDocument> =
  (mongoose.models.MessageBody as mongoose.Model<IMessageBodyDocument>) ||
  mongoose.model<IMessageBodyDocument>('MessageBody', messageBodySchema);
