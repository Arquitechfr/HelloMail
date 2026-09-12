import { Schema, model, type Document, type Types } from 'mongoose';

export type SenderListType = 'allow' | 'deny';

export interface ISenderList {
  userId: Types.ObjectId;
  type: SenderListType;
  target: string; // "user@example.com" ou "@example.com" ou "example.com"
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SenderListDocument = ISenderList & Document;

const senderListSchema = new Schema<ISenderList>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['allow', 'deny'], required: true },
    target: { type: String, required: true, trim: true, lowercase: true },
    note: { type: String, trim: true, maxlength: 200 },
  },
  {
    timestamps: true,
  },
);

// Index composé unique par utilisateur, type et cible
senderListSchema.index({ userId: 1, type: 1, target: 1 }, { unique: true });
// Index pour la recherche rapide d'une cible donnée
senderListSchema.index({ userId: 1, target: 1 });

export const SenderListModel = model<ISenderList>('SenderList', senderListSchema);
