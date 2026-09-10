import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearDb } from '../../test/setup.js';
import { UserModel } from '../../models/User.js';
import {
  generateTOTPSetup,
  enableTOTP,
  verifyTOTP,
  disable2FA,
  verifyBackupCode,
  verify2FALogin,
  is2FAEnabled,
} from './twoFactorService.js';

// Mock otplib (API async v13).
vi.mock('otplib', () => ({
  generateSecret: () => 'TESTSECRETBASE32',
  generate: vi.fn(async () => '123456'),
  verify: vi.fn(async ({ token }: { token: string }) => ({ valid: token === '123456' })),
  generateURI: ({ secret, label, issuer }: { secret: string; label: string; issuer: string }) =>
    `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`,
}));

// Mock qrcode.
vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn(async () => 'data:image/png;base64,FAKEQR'),
  },
}));

describe('twoFactorService', () => {
  let userId: string;

  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearDb();
    vi.clearAllMocks();

    const user = await UserModel.create({
      email: '2fa@test.com',
      passwordHash: '$2a$12$fakehash',
    });
    userId = user._id.toString();
  });

  it('generateTOTPSetup génère un QR code et stocke le secret chiffré', async () => {
    const user = await UserModel.findById(userId);
    const result = await generateTOTPSetup(user!);

    expect(result.qrCodeUrl).toBe('data:image/png;base64,FAKEQR');
    expect(result.secret).toBe('TESTSECRETBASE32');

    // Vérifie que le secret est stocké chiffré.
    const updated = await UserModel.findById(userId).select('+twoFactorSecret');
    expect(updated?.twoFactorSecret).toBeDefined();
    expect(updated?.twoFactorSecret).not.toBe('TESTSECRETBASE32');
  });

  it('enableTOTP active la 2FA avec un code valide et génère des codes de secours', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    const result = await enableTOTP(userWithSecret!, '123456');

    expect(result.backupCodes).toHaveLength(10);
    result.backupCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    });

    // Vérifie que la 2FA est activée.
    const updated = await UserModel.findById(userId).select('+twoFactorEnabled +twoFactorBackupCodes');
    expect(updated?.twoFactorEnabled).toBe(true);
    expect(updated?.twoFactorBackupCodes).toHaveLength(10);
  });

  it('enableTOTP rejette un code invalide', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    await expect(enableTOTP(userWithSecret!, '000000')).rejects.toThrow('Code TOTP invalide');
  });

  it('enableTOTP échoue si le setup n\'a pas été fait', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await expect(enableTOTP(user!, '123456')).rejects.toThrow('2FA non configurée');
  });

  it('verifyTOTP retourne true pour un code valide', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    const result = await verifyTOTP(userWithSecret!, '123456');
    expect(result).toBe(true);
  });

  it('verifyTOTP retourne false pour un code invalide', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    const result = await verifyTOTP(userWithSecret!, '000000');
    expect(result).toBe(false);
  });

  it('verifyTOTP retourne false si pas de secret', async () => {
    const user = await UserModel.findById(userId);
    const result = await verifyTOTP(user!, '123456');
    expect(result).toBe(false);
  });

  it('disable2FA réinitialise tous les champs 2FA', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    const userWith2FA = await UserModel.findById(userId);
    await disable2FA(userWith2FA!);

    const updated = await UserModel.findById(userId)
      .select('+twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes +webauthnCredentials');
    expect(updated?.twoFactorEnabled).toBe(false);
    expect(updated?.twoFactorSecret).toBe('');
    expect(updated?.twoFactorBackupCodes).toHaveLength(0);
    expect(updated?.webauthnCredentials).toHaveLength(0);
  });

  it('verifyBackupCode valide et consomme un code de secours', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    const { backupCodes } = await enableTOTP(userWithSecret!, '123456');

    const userWith2FA = await UserModel.findById(userId).select('+twoFactorBackupCodes');
    const isValid = await verifyBackupCode(userWith2FA!, backupCodes[0]);
    expect(isValid).toBe(true);

    // Le code doit être consommé (supprimé).
    const after = await UserModel.findById(userId).select('+twoFactorBackupCodes');
    expect(after?.twoFactorBackupCodes).toHaveLength(9);
  });

  it('verifyBackupCode rejette un code invalide', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    const userWith2FA = await UserModel.findById(userId).select('+twoFactorBackupCodes');
    const isValid = await verifyBackupCode(userWith2FA!, 'INVALID-CODE');
    expect(isValid).toBe(false);
  });

  it('verify2FALogin valide via TOTP', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    const userWith2FA = await UserModel.findById(userId)
      .select('+twoFactorEnabled +twoFactorSecret +twoFactorBackupCodes');
    const result = await verify2FALogin(userWith2FA!, '123456');
    expect(result).toBe(true);
  });

  it('is2FAEnabled retourne true si activée', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorSecret');
    await generateTOTPSetup(user!);

    const userWithSecret = await UserModel.findById(userId).select('+twoFactorSecret');
    await enableTOTP(userWithSecret!, '123456');

    const userWith2FA = await UserModel.findById(userId).select('+twoFactorEnabled');
    expect(is2FAEnabled(userWith2FA!)).toBe(true);
  });

  it('is2FAEnabled retourne false si non activée', async () => {
    const user = await UserModel.findById(userId).select('+twoFactorEnabled');
    expect(is2FAEnabled(user!)).toBe(false);
  });
});
