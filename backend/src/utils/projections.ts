/**
 * Projection Mongoose réutilisée pour exclure systématiquement
 * les champs secrets (mots de passe chiffrés, refresh tokens OAuth)
 * de toute réponse API ou requête de lecture sur les comptes.
 */
export const ACCOUNT_SAFE_PROJECTION = {
  'imapConfig.encryptedPassword': 0,
  'oauthConfig.encryptedRefreshToken': 0,
} as const;
