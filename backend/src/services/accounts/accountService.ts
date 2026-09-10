import { AccountModel, IAccountDocument } from '../../models/Account.js';
import { AppError } from '../../utils/AppError.js';
import { ACCOUNT_SAFE_PROJECTION } from '../../utils/projections.js';
import { encrypt } from '../security/encryptionService.js';
import { testImapConnection, testSmtpConnection } from '../email/connectionTest.js';

export interface CreateImapAccountInput {
  emailAddress: string;
  displayName?: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
}

function sanitize(doc: IAccountDocument): IAccountDocument {
  doc.imapConfig && delete (doc.imapConfig as any).encryptedPassword;
  doc.oauthConfig && delete (doc.oauthConfig as any).encryptedRefreshToken;
  return doc;
}

export class AccountService {
  /**
   * Crée un compte IMAP : vérifie l'unicité, teste les connexions IMAP + SMTP
   * AVANT toute écriture en base, chiffre le mot de passe, puis persiste.
   */
  static async createImapAccount(userId: string, input: CreateImapAccountInput): Promise<IAccountDocument> {
    const existing = await AccountModel.findOne({ userId, emailAddress: input.emailAddress });
    if (existing) {
      throw AppError.conflict('Ce compte email est déjà configuré');
    }

    // Test des connexions avant chiffrement et persistence
    await testImapConnection({
      host: input.imap.host,
      port: input.imap.port,
      secure: input.imap.secure,
      username: input.imap.username,
      password: input.imap.password,
    });

    await testSmtpConnection({
      host: input.smtp.host,
      port: input.smtp.port,
      secure: input.smtp.secure,
      username: input.imap.username,
      password: input.imap.password,
    });

    const encryptedPassword = encrypt(input.imap.password);

    // Utilise new Model() + save() pour que le hook pre('validate') s'exécute
    const account = new AccountModel({
      userId,
      provider: 'imap',
      emailAddress: input.emailAddress,
      displayName: input.displayName,
      imapConfig: {
        host: input.imap.host,
        port: input.imap.port,
        secure: input.imap.secure,
        smtpHost: input.smtp.host,
        smtpPort: input.smtp.port,
        smtpSecure: input.smtp.secure,
        username: input.imap.username,
        encryptedPassword,
      },
    });

    await account.save();

    // Recharger avec la projection safe
    const saved = await AccountModel.findById(account._id).select(ACCOUNT_SAFE_PROJECTION);
    return saved!;
  }

  /**
   * Liste les comptes d'un utilisateur en excluant les champs secrets.
   */
  static async listAccounts(userId: string): Promise<IAccountDocument[]> {
    return AccountModel.find({ userId }).select(ACCOUNT_SAFE_PROJECTION).lean();
  }

  /**
   * Supprime un compte. AppError 404 si aucun document supprimé.
   */
  static async deleteAccount(userId: string, accountId: string): Promise<void> {
    const result = await AccountModel.deleteOne({ _id: accountId, userId });
    if (result.deletedCount === 0) {
      throw AppError.notFound('Compte introuvable');
    }
  }

  /**
   * Active ou désactive un compte. Ne met à jour QUE isActive.
   * AppError 404 si introuvable.
   */
  static async toggleAccountActive(
    userId: string,
    accountId: string,
    isActive: boolean,
  ): Promise<IAccountDocument> {
    const account = await AccountModel.findOneAndUpdate(
      { _id: accountId, userId },
      { isActive },
      { new: true },
    ).select(ACCOUNT_SAFE_PROJECTION);

    if (!account) {
      throw AppError.notFound('Compte introuvable');
    }

    return account;
  }
}
