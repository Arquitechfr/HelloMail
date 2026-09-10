import mongoose, { Schema, Document } from 'mongoose';

export interface ITemplateDocument extends Document {
  userId: mongoose.Types.ObjectId;
  accountId?: mongoose.Types.ObjectId | null;
  title: string;
  subject?: string;
  bodyHtml: string;
  bodyText: string;
  shortcut?: string;
  order: number;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplateDocument>(
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
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    subject: {
      type: String,
      trim: true,
      maxlength: 998,
      default: '',
    },
    bodyHtml: {
      type: String,
      required: true,
    },
    bodyText: {
      type: String,
      required: true,
    },
    shortcut: {
      type: String,
      trim: true,
      maxlength: 30,
      default: undefined,
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

// Index pour l'ordonnancement des modèles par utilisateur
templateSchema.index({ userId: 1, order: 1 });

// Index pour le filtrage par compte spécifique ou global
templateSchema.index({ userId: 1, accountId: 1 });

// Index pour la recherche rapide par raccourci
templateSchema.index({ userId: 1, shortcut: 1 });

export const TemplateModel: mongoose.Model<ITemplateDocument> =
  (mongoose.models.Template as mongoose.Model<ITemplateDocument>) ||
  mongoose.model<ITemplateDocument>('Template', templateSchema);
