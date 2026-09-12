import mongoose, { Schema, Document } from 'mongoose';

export type AccountProvider = 'imap' | 'google_oauth' | 'microsoft_oauth';

export interface EncryptedField {
  iv: string;
  authTag: string;
  ciphertext: string;
}

export interface IAccountDocument extends Document {
  userId: mongoose.Types.ObjectId;
  provider: AccountProvider;
  emailAddress: string;
  displayName?: string;
  imapConfig?: {
    host: string;
    port: number;
    secure: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    username: string;
    encryptedPassword: EncryptedField;
  };
  oauthConfig?: {
    encryptedRefreshToken: EncryptedField;
    accessTokenExpiresAt?: Date;
    scope: string[];
  };
  signature?: ISignatureConfig;
  color?: string;
  isActive: boolean;
  lastSyncedAt?: Date;
  lastSyncError?: string;
  aliases?: IAccountAlias[];
  storageQuota?: IStorageQuota;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStorageQuota {
  supported: boolean;
  usedBytes?: number;
  totalBytes?: number;
  percentage?: number;
  usedMessages?: number;
  totalMessages?: number;
  updatedAt: Date;
}

export interface ISignatureConfig {
  enabled: boolean;
  text: string;
  html?: string;
  variables?: {
    phone?: string;
    jobTitle?: string;
    company?: string;
  };
}

export interface IAccountAlias {
  _id?: mongoose.Types.ObjectId;
  name?: string;
  email: string;
  isDefault?: boolean;
  signature?: ISignatureConfig;
}

const encryptedFieldSchema = new Schema<EncryptedField>(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);

const signatureConfigSchema = new Schema<ISignatureConfig>(
  {
    enabled: { type: Boolean, default: false },
    text: { type: String, default: '' },
    html: { type: String, required: false },
    variables: {
      phone: { type: String, required: false },
      jobTitle: { type: String, required: false },
      company: { type: String, required: false },
    },
  },
  { _id: false },
);

const accountAliasSchema = new Schema<IAccountAlias>(
  {
    name: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    isDefault: { type: Boolean, default: false },
    signature: { type: signatureConfigSchema, required: false },
  },
  { _id: true },
);

const storageQuotaSchema = new Schema<IStorageQuota>(
  {
    supported: { type: Boolean, default: true },
    usedBytes: { type: Number, required: false },
    totalBytes: { type: Number, required: false },
    percentage: { type: Number, required: false },
    usedMessages: { type: Number, required: false },
    totalMessages: { type: Number, required: false },
    updatedAt: { type: Date, required: false },
  },
  { _id: false },
);

const accountSchema = new Schema<IAccountDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['imap', 'google_oauth', 'microsoft_oauth'],
      required: true,
    },
    emailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    imapConfig: {
      host: { type: String, required: false },
      port: { type: Number, required: false },
      secure: { type: Boolean, required: false },
      smtpHost: { type: String, required: false },
      smtpPort: { type: Number, required: false },
      smtpSecure: { type: Boolean, required: false },
      username: { type: String, required: false },
      encryptedPassword: { type: encryptedFieldSchema, required: false },
    },
    oauthConfig: {
      encryptedRefreshToken: { type: encryptedFieldSchema, required: false },
      accessTokenExpiresAt: { type: Date, required: false },
      scope: { type: [String], default: [] },
    },
    signature: {
      type: signatureConfigSchema,
      default: () => ({ enabled: false, text: '' }),
    },
    color: {
      type: String,
      default: '#3b82f6',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSyncedAt: {
      type: Date,
    },
    lastSyncError: {
      type: String,
    },
    aliases: {
      type: [accountAliasSchema],
      default: [],
    },
    storageQuota: {
      type: storageQuotaSchema,
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

accountSchema.index({ userId: 1, emailAddress: 1 }, { unique: true });

/**
 * Hook pre('validate') : vérifie la cohérence provider ↔ config.
 * Ne s'exécute que sur new Model() + .save(), PAS sur findOneAndUpdate.
 */
accountSchema.pre('validate', async function () {
  const account = this as unknown as IAccountDocument;

  if (account.provider === 'imap' && !account.imapConfig?.encryptedPassword) {
    throw new Error('imapConfig est requis pour un compte de type imap');
  }

  if (
    (account.provider === 'google_oauth' || account.provider === 'microsoft_oauth') &&
    !account.oauthConfig?.encryptedRefreshToken
  ) {
    throw new Error('oauthConfig est requis pour un compte de type OAuth');
  }
});

export const AccountModel: mongoose.Model<IAccountDocument> =
  (mongoose.models.Account as mongoose.Model<IAccountDocument>) ||
  mongoose.model<IAccountDocument>('Account', accountSchema);
