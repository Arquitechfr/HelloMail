import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import * as contactService from '../services/contacts/contactService.js';

/** GET /api/contacts — liste les contacts de l'utilisateur. */
export const listContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const contacts = await contactService.listContacts(req.user.id);
  res.status(200).json({ contacts });
});

/** POST /api/contacts — crée un contact. */
export const createContact = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const contact = await contactService.createContact(req.user.id, req.body);
  res.status(201).json({ contact });
});

/** PATCH /api/contacts/:id — met à jour un contact. */
export const updateContact = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const contact = await contactService.updateContact(req.user.id, req.params.id, req.body);
  res.status(200).json({ contact });
});

/** DELETE /api/contacts/:id — supprime un contact. */
export const deleteContact = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  await contactService.deleteContact(req.user.id, req.params.id);
  res.status(200).json({ message: 'Contact supprimé' });
});

/** GET /api/contacts/search?q=... — recherche des contacts. */
export const searchContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const q = req.query.q as string;
  if (!q) {
    throw AppError.badRequest('Paramètre de recherche "q" requis');
  }
  const contacts = await contactService.searchContacts(req.user.id, q);
  res.status(200).json({ contacts });
});
