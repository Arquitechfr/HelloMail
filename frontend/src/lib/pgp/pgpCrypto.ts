import * as openpgp from 'openpgp';

export interface GeneratePgpKeyOptions {
  name?: string;
  email: string;
  passphrase?: string;
  type?: 'ecc' | 'rsa';
  rsaBits?: 2048 | 4096;
}

export interface GeneratedPgpKeyPair {
  armoredPublicKey: string;
  armoredPrivateKey: string;
  fingerprint: string;
  keyId: string;
  algorithm: string;
}

export interface PgpDecryptedResult {
  decryptedText: string;
  isSigned: boolean;
  signatureValid?: boolean;
}

/**
 * Génère une nouvelle paire de clés OpenPGP (Curve25519 par défaut ou RSA).
 */
export async function generatePgpKeyPair(
  options: GeneratePgpKeyOptions,
): Promise<GeneratedPgpKeyPair> {
  const userIDs = [{ name: options.name || '', email: options.email }];
  const isRsa = options.type === 'rsa';

  const { privateKey, publicKey } = await openpgp.generateKey({
    userIDs,
    passphrase: options.passphrase || undefined,
    type: isRsa ? 'rsa' : 'curve25519',
    rsaBits: isRsa ? options.rsaBits || 4096 : undefined,
  });

  const parsedKey = await openpgp.readKey({ armoredKey: publicKey });
  const fingerprint = parsedKey.getFingerprint().toUpperCase();
  const keyId = parsedKey.getKeyID().toHex().toUpperCase();
  const algorithm = isRsa ? `RSA ${options.rsaBits || 4096}` : 'Curve25519';

  return {
    armoredPublicKey: publicKey,
    armoredPrivateKey: privateKey,
    fingerprint,
    keyId,
    algorithm,
  };
}

/**
 * Inspecte et extrait les métadonnées d'une clé OpenPGP (publique ou privée).
 */
export async function readPgpKeyInfo(armoredKey: string): Promise<{
  fingerprint: string;
  keyId: string;
  userIDs: string[];
  algorithm: string;
  isPrivate: boolean;
}> {
  const key = await openpgp.readKey({ armoredKey });
  const fingerprint = key.getFingerprint().toUpperCase();
  const keyId = key.getKeyID().toHex().toUpperCase();
  const userIDs = key.getUserIDs();
  const algoInfo = key.getAlgorithmInfo();
  const algorithm = algoInfo.algorithm || 'OpenPGP';
  const isPrivate = key.isPrivate();

  return { fingerprint, keyId, userIDs, algorithm, isPrivate };
}

/**
 * Détecte si le texte contient un bloc de message chiffré OpenPGP.
 */
export function isPgpEncrypted(content?: string): boolean {
  if (!content) return false;
  return content.includes('-----BEGIN PGP MESSAGE-----');
}

/**
 * Détecte si le texte contient un bloc de message signé en clair OpenPGP.
 */
export function isPgpSigned(content?: string): boolean {
  if (!content) return false;
  return content.includes('-----BEGIN PGP SIGNED MESSAGE-----');
}

/**
 * Formate une empreinte de 40 caractères en groupes de 4 caractères séparés par des espaces.
 */
export function formatFingerprint(fingerprint: string): string {
  const cleaned = fingerprint.replace(/\s+/g, '').toUpperCase();
  return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
}

/**
 * Déchiffre un message OpenPGP avec une clé privée (et passphrase optionnelle).
 */
export async function decryptPgpMessage(options: {
  armoredMessage: string;
  armoredPrivateKey: string;
  passphrase?: string;
  senderPublicKeyArmored?: string;
}): Promise<PgpDecryptedResult> {
  let privateKey = await openpgp.readPrivateKey({
    armoredKey: options.armoredPrivateKey,
  });

  if (options.passphrase) {
    privateKey = await openpgp.decryptKey({
      privateKey,
      passphrase: options.passphrase,
    });
  }

  const message = await openpgp.readMessage({
    armoredMessage: options.armoredMessage,
  });

  const verificationKeys = options.senderPublicKeyArmored
    ? await openpgp.readKey({ armoredKey: options.senderPublicKeyArmored })
    : undefined;

  const { data: decryptedData, signatures } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    verificationKeys,
  });

  let signatureValid: boolean | undefined = undefined;
  if (signatures && signatures.length > 0 && verificationKeys) {
    try {
      await signatures[0].verified;
      signatureValid = true;
    } catch {
      signatureValid = false;
    }
  }

  return {
    decryptedText: String(decryptedData),
    isSigned: Boolean(signatures && signatures.length > 0),
    signatureValid,
  };
}

/**
 * Chiffre un texte pour une liste de clés publiques et signe facultativement avec la clé de l'expéditeur.
 */
export async function encryptPgpMessage(options: {
  plainText: string;
  recipientPublicKeysArmored: string[];
  senderPrivateKeyArmored?: string;
  passphrase?: string;
}): Promise<string> {
  const encryptionKeys = await Promise.all(
    options.recipientPublicKeysArmored.map((armoredKey) =>
      openpgp.readKey({ armoredKey }),
    ),
  );

  let signingKeys: openpgp.PrivateKey | undefined = undefined;
  if (options.senderPrivateKeyArmored) {
    let key = await openpgp.readPrivateKey({
      armoredKey: options.senderPrivateKeyArmored,
    });
    if (options.passphrase) {
      key = await openpgp.decryptKey({
        privateKey: key,
        passphrase: options.passphrase,
      });
    }
    signingKeys = key;
  }

  const message = await openpgp.createMessage({ text: options.plainText });
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys,
    signingKeys,
  });

  return String(encrypted);
}

/**
 * Vérifie un message signé en clair OpenPGP (Cleartext signed message).
 */
export async function verifyPgpSignature(options: {
  armoredSignedMessage: string;
  senderPublicKeyArmored?: string;
}): Promise<{ text: string; signatureValid: boolean }> {
  const cleartextMessage = await openpgp.readCleartextMessage({
    cleartextMessage: options.armoredSignedMessage,
  });

  if (!options.senderPublicKeyArmored) {
    return {
      text: cleartextMessage.getText(),
      signatureValid: false,
    };
  }

  const verificationKeys = await openpgp.readKey({
    armoredKey: options.senderPublicKeyArmored,
  });

  const verification = await openpgp.verify({
    message: cleartextMessage,
    verificationKeys,
  });

  let signatureValid = false;
  try {
    await verification.signatures[0].verified;
    signatureValid = true;
  } catch {
    signatureValid = false;
  }

  return {
    text: cleartextMessage.getText(),
    signatureValid,
  };
}
