import mongoose, { Schema, Document } from 'mongoose';

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType?: string;
  transports?: string[];
  createdAt: Date;
}

export interface IUserPreferences {
  undoSendDelay?: number; // 0, 5, 10, 15, 30 secondes (défaut: 5)
  autoAddContacts?: boolean; // ajout auto des expéditeurs au carnet (défaut: false)
}

export interface IUserDocument extends Document {
  email: string;
  passwordHash: string;
  // --- 2FA (Phase 6) ---
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // chiffré (AES-256-GCM)
  twoFactorBackupCodes?: string[]; // hachés (bcrypt)
  webauthnCredentials?: WebAuthnCredential[];
  currentWebauthnChallenge?: string;
  // --- Préférences utilisateur (Phase 9) ---
  preferences?: IUserPreferences;
  // --- Contenu prédéfini (presets) ---
  defaultsSeededAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webauthnCredentialSchema = new Schema<WebAuthnCredential>(
  {
    id: { type: String, required: true },
    publicKey: { type: String, required: true },
    counter: { type: Number, required: true, default: 0 },
    deviceType: { type: String },
    transports: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false,
    },
    twoFactorBackupCodes: {
      type: [String],
      select: false,
      default: [],
    },
    webauthnCredentials: {
      type: [webauthnCredentialSchema],
      select: false,
      default: [],
    },
    currentWebauthnChallenge: {
      type: String,
      select: false,
    },
    preferences: {
      undoSendDelay: {
        type: Number,
        default: 5,
      },
      autoAddContacts: {
        type: Boolean,
        default: false,
      },
    },
    defaultsSeededAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.twoFactorSecret;
        delete ret.twoFactorBackupCodes;
        delete ret.webauthnCredentials;
        delete ret.currentWebauthnChallenge;
        return ret;
      },
    },
  },
);

export const UserModel: mongoose.Model<IUserDocument> =
  (mongoose.models.User as mongoose.Model<IUserDocument>) ||
  mongoose.model<IUserDocument>('User', userSchema);
