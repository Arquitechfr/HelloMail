import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPgpKey {
  userId: Types.ObjectId;
  email: string;
  name?: string;
  armoredPublicKey: string;
  armoredPrivateKey?: string;
  fingerprint: string;
  keyId: string;
  algorithm: string;
  isOwnKey: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPgpKeyDocument extends IPgpKey, Document {}

const pgpKeySchema = new Schema<IPgpKeyDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      trim: true,
    },
    armoredPublicKey: {
      type: String,
      required: true,
    },
    armoredPrivateKey: {
      type: String,
    },
    fingerprint: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    keyId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    algorithm: {
      type: String,
      required: true,
      default: 'Curve25519',
    },
    isOwnKey: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

pgpKeySchema.index({ userId: 1, isOwnKey: 1 });
pgpKeySchema.index({ userId: 1, email: 1 });
pgpKeySchema.index({ userId: 1, fingerprint: 1 }, { unique: true });

export const PgpKeyModel = mongoose.model<IPgpKeyDocument>('PgpKey', pgpKeySchema);
