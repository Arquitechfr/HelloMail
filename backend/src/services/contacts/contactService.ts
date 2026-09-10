import { ContactModel, type IContactDocument } from '../../models/Contact.js';
import { AppError } from '../../utils/AppError.js';

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
