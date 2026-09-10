import mongoose, { Schema, Document } from 'mongoose';

export interface IContactDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactSchema = new Schema<IContactDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
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

// Index textuel pour la recherche/autocomplétion.
contactSchema.index({ name: 'text', email: 'text' });

// Index unique pour éviter les doublons par utilisateur.
contactSchema.index({ userId: 1, email: 1 }, { unique: true });

export const ContactModel: mongoose.Model<IContactDocument> =
  (mongoose.models.Contact as mongoose.Model<IContactDocument>) ||
  mongoose.model<IContactDocument>('Contact', contactSchema);
