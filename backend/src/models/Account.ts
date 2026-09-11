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
  signature?: {
    enabled: boolean;
    text: string;
    html?: string;
  };
  color?: string;
  isActive: boolean;
  lastSyncedAt?: Date;
  lastSyncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const encryptedFieldSchema = new Schema<EncryptedField>(
  {
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    ciphertext: { type: String, required: true },
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
      enabled: { type: Boolean, default: false },
      text: { type: String, default: '' },
      html: { type: String, required: false },
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
