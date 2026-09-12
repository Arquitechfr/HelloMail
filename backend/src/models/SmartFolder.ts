import { Schema, model, type Document, type Types } from 'mongoose';

export interface ISmartFolder {
  userId: Types.ObjectId;
  name: string;
  icon?: string;
  color?: string;
  query: string;
  accountId?: Types.ObjectId;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SmartFolderDocument = ISmartFolder & Document;

const smartFolderSchema = new Schema<ISmartFolder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    icon: { type: String, trim: true, default: 'Sparkles' },
    color: { type: String, trim: true, default: '#3b82f6' },
    query: { type: String, required: true, trim: true, maxlength: 300 },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: false },
    order: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
  },
);

smartFolderSchema.index({ userId: 1, order: 1, createdAt: 1 });

export const SmartFolderModel = model<ISmartFolder>('SmartFolder', smartFolderSchema);
