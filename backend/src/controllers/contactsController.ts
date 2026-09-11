import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import * as contactService from '../services/contacts/contactService.js';
import * as contactImportExportService from '../services/contacts/contactImportExportService.js';

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

/** GET /api/contacts/export?format=vcf|csv — exporte les contacts. */
export const exportContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const format = (req.query.format as string)?.toLowerCase() === 'csv' ? 'csv' : 'vcf';
  const contacts = await contactService.listContacts(req.user.id);

  if (format === 'csv') {
    const csvData = contactImportExportService.exportToCsv(contacts);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.status(200).send(csvData);
  } else {
    const vcfData = contactImportExportService.exportToVCard(contacts);
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.vcf"');
    res.status(200).send(vcfData);
  }
});

/** POST /api/contacts/import — importe des contacts (vCard ou CSV). */
export const importContacts = asyncHandler(async (req: AuthenticatedRequest, res: Response, _next: NextFunction) => {
  const { content, format } = req.body;
  if (!content || typeof content !== 'string') {
    throw AppError.badRequest('Contenu à importer manquant ou invalide');
  }

  const isVCard = format === 'vcf' || content.includes('BEGIN:VCARD');
  const parsed = isVCard
    ? contactImportExportService.parseVCard(content)
    : contactImportExportService.parseCsv(content);

  const result = await contactImportExportService.importContacts(req.user.id, parsed);
  res.status(200).json(result);
});
