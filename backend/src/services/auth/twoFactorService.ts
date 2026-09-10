import { generateSecret, generate, verify, generateURI } from 'otplib';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import { AppError } from '../../utils/AppError.js';
import { encrypt, decrypt } from '../security/encryptionService.js';
import { UserModel, type IUserDocument } from '../../models/User.js';

/** Nombre de codes de secours générés. */
const BACKUP_CODES_COUNT = 10;

/**
 * Génère un secret TOTP et l'URL otpauth pour le QR code.
 * Le secret est chiffré avant stockage en base.
 */
export async function generateTOTPSetup(
  user: IUserDocument,
): Promise<{ qrCodeUrl: string; secret: string }> {
  const secret = generateSecret();
  const encryptedSecret = encrypt(secret);

  // Stocke le secret chiffré (non activé tant que la vérification n'est pas faite).
  await UserModel.updateOne(
    { _id: user._id },
    { twoFactorSecret: JSON.stringify(encryptedSecret) },
  );

  // Construit l'URL otpauth (format standard TOTP).
  const otpauthUrl = generateURI({ secret, label: user.email, issuer: 'HelloMail' });

  // Génère le QR code en data URL (base64 PNG).
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  return { qrCodeUrl, secret };
}

/**
 * Vérifie un code TOTP et active la 2FA si valide.
 * Génère aussi les codes de secours.
 */
export async function enableTOTP(
  user: IUserDocument,
  token: string,
): Promise<{ backupCodes: string[] }> {
  if (!user.twoFactorSecret) {
    throw AppError.badRequest('2FA non configurée — générez d\'abord le QR code');
  }

  // Déchiffre le secret stocké.
  const encryptedSecret = JSON.parse(user.twoFactorSecret) as {
    iv: string;
    authTag: string;
    ciphertext: string;
  };
  const secret = decrypt(encryptedSecret);

  // Vérifie le token TOTP.
  const result = await verify({ token, secret });
  if (!result.valid) {
    throw AppError.unauthorized('Code TOTP invalide');
  }

  // Génère les codes de secours.
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = await hashBackupCodes(backupCodes);

  // Active la 2FA.
  await UserModel.updateOne(
    { _id: user._id },
    {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedBackupCodes,
    },
  );

  return { backupCodes };
}

/**
 * Vérifie un code TOTP (sans activerer — pour le login).
 */
export async function verifyTOTP(user: IUserDocument, token: string): Promise<boolean> {
  if (!user.twoFactorSecret) {
    return false;
  }

  try {
    const encryptedSecret = JSON.parse(user.twoFactorSecret) as {
      iv: string;
      authTag: string;
      ciphertext: string;
    };
    const secret = decrypt(encryptedSecret);
    const result = await verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
}

/**
 * Désactive la 2FA (TOTP + WebAuthn + codes de secours).
 */
export async function disable2FA(user: IUserDocument): Promise<void> {
  await UserModel.updateOne(
    { _id: user._id },
    {
      twoFactorEnabled: false,
      twoFactorSecret: '',
      twoFactorBackupCodes: [],
      webauthnCredentials: [],
      currentWebauthnChallenge: '',
    },
  );
}

/**
 * Génère 10 codes de secours aléatoires (format XXXX-XXXX).
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
    const random = Math.random().toString(36).slice(2, 10).toUpperCase();
    codes.push(`${random.slice(0, 4)}-${random.slice(4)}`);
  }
  return codes;
}

/**
 * Hache les codes de secours avec bcrypt.
 */
async function hashBackupCodes(codes: string[]): Promise<string[]> {
  const hashed: string[] = [];
  for (const code of codes) {
    hashed.push(await bcrypt.hash(code, 10));
  }
  return hashed;
}

/**
 * Vérifie un code de secours et le consomme (supprime de la liste).
 * Retourne true si le code est valide, false sinon.
 */
export async function verifyBackupCode(
  user: IUserDocument,
  code: string,
): Promise<boolean> {
  if (!user.twoFactorBackupCodes || user.twoFactorBackupCodes.length === 0) {
    return false;
  }

  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    const hashedCode = user.twoFactorBackupCodes[i];
    const isValid = await bcrypt.compare(code, hashedCode);
    if (isValid) {
      // Consomme le code : le supprime de la liste.
      const remainingCodes = [...user.twoFactorBackupCodes];
      remainingCodes.splice(i, 1);
      await UserModel.updateOne(
        { _id: user._id },
        { twoFactorBackupCodes: remainingCodes },
      );
      return true;
    }
  }

  return false;
}

/**
 * Vérifie la 2FA pour le login : TOTP ou code de secours.
 * Retourne true si au moins une méthode est valide.
 */
export async function verify2FALogin(
  user: IUserDocument,
  token: string,
): Promise<boolean> {
  // Tente TOTP d'abord.
  if (await verifyTOTP(user, token)) {
    return true;
  }

  // Tente code de secours.
  return verifyBackupCode(user, token);
}

/**
 * Vérifie si l'utilisateur a la 2FA activée.
 */
export function is2FAEnabled(user: IUserDocument): boolean {
  return user.twoFactorEnabled === true;
}
