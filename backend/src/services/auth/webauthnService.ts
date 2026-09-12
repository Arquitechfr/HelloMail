import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { UserModel, type IUserDocument, type WebAuthnCredential } from '../../models/User.js';

/**
 * Détermine le rpID (relying party ID) depuis la première URL de FRONTEND_URL.
 * Ex : http://localhost:3001 → localhost
 *      https://mail.example.com → mail.example.com
 */
function getRpId(): string {
  try {
    const url = new URL(env.FRONTEND_URL[0]);
    return url.hostname;
  } catch {
    return 'localhost';
  }
}

const RP_NAME = 'Mailora';

/**
 * Génère les options d'enregistrement WebAuthn pour un utilisateur.
 * Stocke le challenge en base pour vérification ultérieure.
 */
export async function generateWebAuthnRegistration(
  user: IUserDocument,
): Promise<ReturnType<typeof generateRegistrationOptions>> {
  const existingCredentials: WebAuthnCredential[] = user.webauthnCredentials ?? [];

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: getRpId(),
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: existingCredentials.map((cred) => ({
      id: cred.id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  // Stocke le challenge pour vérification.
  await UserModel.updateOne(
    { _id: user._id },
    { currentWebauthnChallenge: options.challenge },
  );

  return options;
}

/**
 * Vérifie la réponse d'enregistrement WebAuthn et stocke la credential.
 */
export async function verifyWebAuthnRegistration(
  user: IUserDocument,
  response: unknown,
): Promise<{ verified: boolean }> {
  if (!user.currentWebauthnChallenge) {
    throw AppError.badRequest('Aucun challenge WebAuthn en cours');
  }

  const expectedChallenge = user.currentWebauthnChallenge;
  const expectedOrigin = env.FRONTEND_URL;
  const expectedRPID = getRpId();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
    });
  } catch (error) {
    throw AppError.unauthorized(
      `Vérification WebAuthn échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  }

  if (!verification.verified || !verification.registrationInfo) {
    throw AppError.unauthorized('Enregistrement WebAuthn échoué');
  }

  const { credential, credentialDeviceType } = verification.registrationInfo;

  const newCredential: WebAuthnCredential = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    deviceType: credentialDeviceType,
    transports: credential.transports ?? [],
    createdAt: new Date(),
  };

  // Ajoute la credential à la liste et active la 2FA.
  await UserModel.updateOne(
    { _id: user._id },
    {
      $push: { webauthnCredentials: newCredential },
      twoFactorEnabled: true,
      currentWebauthnChallenge: '',
    },
  );

  return { verified: true };
}

/**
 * Génère les options d'authentification WebAuthn pour un utilisateur.
 */
export async function generateWebAuthnLogin(
  user: IUserDocument,
): Promise<ReturnType<typeof generateAuthenticationOptions>> {
  const existingCredentials: WebAuthnCredential[] = user.webauthnCredentials ?? [];

  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    allowCredentials: existingCredentials.map((cred) => ({
      id: cred.id,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  // Stocke le challenge pour vérification.
  await UserModel.updateOne(
    { _id: user._id },
    { currentWebauthnChallenge: options.challenge },
  );

  return options;
}

/**
 * Vérifie la réponse d'authentification WebAuthn.
 * Met à jour le counter de la credential.
 */
export async function verifyWebAuthnLogin(
  user: IUserDocument,
  response: unknown,
): Promise<{ verified: boolean }> {
  if (!user.currentWebauthnChallenge) {
    throw AppError.badRequest('Aucun challenge WebAuthn en cours');
  }

  const expectedChallenge = user.currentWebauthnChallenge;
  const expectedOrigin = env.FRONTEND_URL;
  const expectedRPID = getRpId();

  const credentials = user.webauthnCredentials ?? [];
  if (credentials.length === 0) {
    throw AppError.badRequest('Aucune credential WebAuthn enregistrée');
  }

  // Trouve la credential correspondante.
  const responseObj = response as { id?: string };
  const credential = credentials.find((c) => c.id === responseObj.id);
  if (!credential) {
    throw AppError.unauthorized('Credential WebAuthn non reconnue');
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge,
      expectedOrigin,
      expectedRPID,
      credential: {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: credential.counter,
      },
    });
  } catch (error) {
    throw AppError.unauthorized(
      `Authentification WebAuthn échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  }

  if (!verification.verified) {
    throw AppError.unauthorized('Authentification WebAuthn échouée');
  }

  // Met à jour le counter.
  const newCounter = verification.authenticationInfo.newCounter;
  await UserModel.updateOne(
    { _id: user._id, 'webauthnCredentials.id': credential.id },
    {
      $set: { 'webauthnCredentials.$.counter': newCounter },
      currentWebauthnChallenge: '',
    },
  );

  return { verified: true };
}
