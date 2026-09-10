import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshTokenDocument extends Document {
  user: mongoose.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revoked: boolean;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshTokenDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    revoked: {
      type: Boolean,
      default: false,
    },
    userAgent: String,
    ip: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

refreshTokenSchema.index({ tokenHash: 1, revoked: 1 });
refreshTokenSchema.index({ user: 1, tokenHash: 1 });

export const RefreshTokenModel: mongoose.Model<IRefreshTokenDocument> =
  (mongoose.models.RefreshToken as mongoose.Model<IRefreshTokenDocument>) ||
  mongoose.model<IRefreshTokenDocument>('RefreshToken', refreshTokenSchema);
