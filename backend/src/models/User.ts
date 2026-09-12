import mongoose, { Schema, Document } from 'mongoose';

export interface WebAuthnCredential {
  id: string;
  publicKey: string;
  counter: number;
  deviceType?: string;
  transports?: string[];
  createdAt: Date;
}

export interface IUnifiedFolderConfig {
  id: string;
  enabled: boolean;
  order: number;
}

export type DisplayDensity = 'compact' | 'comfortable' | 'spacious';
export type SwipeAction = 'toggle_read' | 'archive' | 'star' | 'trash' | 'junk' | 'none';

export interface IUserPreferences {
  undoSendDelay?: number; // 0, 5, 10, 15, 30 secondes (défaut: 5)
  autoAddContacts?: boolean; // ajout auto des expéditeurs au carnet (défaut: false)
  unifiedFoldersEnabled?: boolean; // activation globale des dossiers unifiés (défaut: true)
  unifiedFolders?: IUnifiedFolderConfig[]; // liste ordonnée et filtrée des boîtes unifiées
  displayDensity?: DisplayDensity; // compact, comfortable, spacious (défaut: comfortable)
  swipeRightAction?: SwipeAction; // toggle_read, archive, star, none (défaut: toggle_read)
  swipeLeftAction?: SwipeAction; // trash, junk, archive, none (défaut: trash)
  attachmentReminderEnabled?: boolean; // détection d'oubli de pièces jointes (défaut: true)
  smartRepliesEnabled?: boolean; // suggestions de réponses rapides (défaut: true)
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
      unifiedFoldersEnabled: {
        type: Boolean,
        default: true,
      },
      unifiedFolders: {
        type: [
          {
            id: { type: String, required: true },
            enabled: { type: Boolean, default: true },
            order: { type: Number, default: 0 },
          },
        ],
        default: undefined,
      },
      displayDensity: {
        type: String,
        enum: ['compact', 'comfortable', 'spacious'],
        default: 'comfortable',
      },
      swipeRightAction: {
        type: String,
        enum: ['toggle_read', 'archive', 'star', 'trash', 'junk', 'none'],
        default: 'toggle_read',
      },
      swipeLeftAction: {
        type: String,
        enum: ['toggle_read', 'archive', 'star', 'trash', 'junk', 'none'],
        default: 'trash',
      },
      attachmentReminderEnabled: {
        type: Boolean,
        default: true,
      },
      smartRepliesEnabled: {
        type: Boolean,
        default: true,
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
