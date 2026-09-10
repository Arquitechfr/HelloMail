import mongoose, { Schema, Document } from 'mongoose';

export interface ITagDocument extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  color: string;
  order: number;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<ITagDocument>(
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
      maxlength: 50,
    },
    color: {
      type: String,
      required: true,
      default: '#3b82f6',
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    isPreset: {
      type: Boolean,
      default: false,
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

// Un utilisateur ne peut pas avoir deux tags portant le même nom.
tagSchema.index({ userId: 1, name: 1 }, { unique: true });
tagSchema.index({ userId: 1, order: 1 });

export const TagModel: mongoose.Model<ITagDocument> =
  mongoose.models.Tag || mongoose.model<ITagDocument>('Tag', tagSchema);
