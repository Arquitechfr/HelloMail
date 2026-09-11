import { Types } from 'mongoose';
import { ContactModel, type IContactDocument } from '../../models/Contact.js';
import { UserModel } from '../../models/User.js';
import { AppError } from '../../utils/AppError.js';
import { logger } from '../../config/logger.js';

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface ContactResult {
  id: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

function toResult(doc: IContactDocument): ContactResult {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    notes: doc.notes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * Liste les contacts d'un utilisateur (tri par nom).
 */
export async function listContacts(userId: string): Promise<ContactResult[]> {
  const contacts = await ContactModel.find({ userId }).sort({ name: 1 }).lean();
  return contacts.map((c) => toResult(c as unknown as IContactDocument));
}

/**
 * Crée un contact. Doublon (userId + email) → 409.
 */
export async function createContact(userId: string, input: ContactInput): Promise<ContactResult> {
  const existing = await ContactModel.findOne({ userId, email: input.email });
  if (existing) {
    throw AppError.conflict('Un contact avec cet email existe déjà');
  }

  const contact = await ContactModel.create({ userId, ...input });
  return toResult(contact);
}

/**
 * Met à jour un contact. Vérifie l'appartenance.
 */
export async function updateContact(
  userId: string,
  contactId: string,
  input: Partial<ContactInput>,
): Promise<ContactResult> {
  const contact = await ContactModel.findOne({ _id: contactId, userId });
  if (!contact) {
    throw AppError.notFound('Contact introuvable');
  }

  // Vérifie le doublon d'email si l'email change.
  if (input.email && input.email !== contact.email) {
    const existing = await ContactModel.findOne({ userId, email: input.email });
    if (existing) {
      throw AppError.conflict('Un contact avec cet email existe déjà');
    }
  }

  Object.assign(contact, input);
  await contact.save();
  return toResult(contact);
}

/**
 * Supprime un contact. Vérifie l'appartenance.
 */
export async function deleteContact(userId: string, contactId: string): Promise<void> {
  const result = await ContactModel.deleteOne({ _id: contactId, userId });
  if (result.deletedCount === 0) {
    throw AppError.notFound('Contact introuvable');
  }
}

/**
 * Recherche des contacts par nom ou email (autocomplétion).
 * Utilise l'index textuel MongoDB.
 */
export async function searchContacts(userId: string, query: string): Promise<ContactResult[]> {
  const contacts = await ContactModel.find({
    userId,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { email: { $regex: query, $options: 'i' } },
    ],
  })
    .sort({ name: 1 })
    .limit(20)
    .lean();

  return contacts.map((c) => toResult(c as unknown as IContactDocument));
}

/**
 * Ajoute l'expéditeur d'un message entrant au carnet d'adresses, si la
 * préférence utilisateur `autoAddContacts` est activée (opt-in).
 *
 * Best-effort : n'écrase jamais un contact existant ($setOnInsert),
 * ignore silencieusement les doublons et les adresses invalides.
 * Appelé par le sync worker (idleLoop) à l'arrivée d'un message en INBOX.
 */
export async function addSenderContactIfEnabled(
  userId: string,
  from: { name?: string; address: string },
): Promise<boolean> {
  const user = await UserModel.findById(userId).select('preferences.autoAddContacts').lean();
  if (!user?.preferences?.autoAddContacts) {
    return false;
  }

  const email = (from.address || '').replace(/[<>]/g, '').toLowerCase().trim();
  // Adresse minimalement valide + exclusion des adresses automatiques et noreply évidents.
  if (
    !email ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
    /^(no-?reply|noreply|donotreply|bounce|mailer-daemon|postmaster|notifications?)@/i.test(email)
  ) {
    return false;
  }

  const contactName = from.name?.trim() || email;

  try {
    const userObjectId = new Types.ObjectId(userId);
    const result = await ContactModel.updateOne(
      { userId: userObjectId, email },
      {
        $setOnInsert: {
          userId: userObjectId,
          name: contactName,
          email,
        },
      },
      { upsert: true },
    );
    return (result.upsertedCount ?? 0) > 0;
  } catch (error) {
    // Doublon concurrent (index unique userId+email) → ignoré.
    logger.debug(
      { userId, error: error instanceof Error ? error.message : 'erreur inconnue' },
      'Ajout contact expéditeur ignoré (doublon)',
    );
    return false;
  }
}
