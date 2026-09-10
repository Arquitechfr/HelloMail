import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';
import { AppError } from '../../utils/AppError.js';

export interface ImapTestConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

export interface SmtpTestConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}

/**
 * Teste une connexion IMAP en se connectant puis en se déconnectant.
 * Ne loggue jamais le mot de passe.
 * Lance une AppError 422 si la connexion échoue.
 */
export async function testImapConnection(config: ImapTestConfig): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
  } catch (error) {
    throw AppError.unprocessable(
      `Connexion IMAP échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  }
}

/**
 * Teste une connexion SMTP en vérifiant le transport.
 * Ne loggue jamais le mot de passe.
 * Lance une AppError 422 si la connexion échoue.
 */
export async function testSmtpConnection(config: SmtpTestConfig): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.username, pass: config.password },
  });

  try {
    await transport.verify();
  } catch (error) {
    throw AppError.unprocessable(
      `Connexion SMTP échouée : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
    );
  } finally {
    transport.close();
  }
}
