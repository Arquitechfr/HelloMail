import { ContactModel, type IContactDocument } from '../../models/Contact.js';
import { AppError } from '../../utils/AppError.js';

export interface ParsedContact {
  name: string;
  email: string;
  phone?: string;
  notes?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * Sérialise une liste de contacts au format vCard 3.0 (RFC 6350 / RFC 2426).
 */
export function exportToVCard(contacts: Array<{ name: string; email: string; phone?: string; notes?: string }>): string {
  const cards: string[] = [];

  for (const c of contacts) {
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `FN:${escapeVCard(c.name || c.email)}`,
      `EMAIL;TYPE=INTERNET:${c.email.trim()}`,
    ];

    if (c.phone?.trim()) {
      lines.push(`TEL;TYPE=VOICE:${c.phone.trim()}`);
    }
    if (c.notes?.trim()) {
      lines.push(`NOTE:${escapeVCard(c.notes.trim())}`);
    }

    lines.push('END:VCARD');
    cards.push(lines.join('\r\n'));
  }

  return cards.join('\r\n\r\n') + '\r\n';
}

function escapeVCard(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

function unescapeVCard(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\;/g, ';')
    .replace(/\\,/g, ',')
    .replace(/\\\\/g, '\\');
}

/**
 * Analyse un contenu vCard (v2.1, v3.0, v4.0) et extrait les contacts.
 */
export function parseVCard(content: string): ParsedContact[] {
  const contacts: ParsedContact[] = [];

  // Dépliage des lignes RFC 6350 (lignes commençant par espace ou tab)
  const unfolded = content.replace(/\r?\n[ \t]/g, '');
  const lines = unfolded.split(/\r?\n/);

  let inCard = false;
  let current: Partial<ParsedContact> = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VCARD') {
      inCard = true;
      current = {};
      continue;
    }

    if (upper === 'END:VCARD') {
      if (inCard && current.email && isValidEmail(current.email)) {
        contacts.push({
          name: current.name?.trim() || current.email,
          email: current.email.toLowerCase().trim(),
          phone: current.phone?.trim() || undefined,
          notes: current.notes?.trim() || undefined,
        });
      }
      inCard = false;
      current = {};
      continue;
    }

    if (!inCard) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const keyPart = line.substring(0, colonIdx).toUpperCase();
    const valPart = line.substring(colonIdx + 1);

    // FN ou N pour le nom
    if (keyPart === 'FN' || keyPart.startsWith('FN;')) {
      if (!current.name) current.name = unescapeVCard(valPart);
    } else if (keyPart === 'N' || keyPart.startsWith('N;')) {
      if (!current.name) {
        // N:Nom;Prénom;...
        const parts = valPart.split(';').map(unescapeVCard).filter(Boolean);
        if (parts.length >= 2) {
          current.name = `${parts[1]} ${parts[0]}`.trim();
        } else if (parts.length === 1) {
          current.name = parts[0].trim();
        }
      }
    } else if (keyPart === 'EMAIL' || keyPart.startsWith('EMAIL;') || keyPart.startsWith('EMAIL:')) {
      if (!current.email) {
        current.email = valPart.trim();
      }
    } else if (keyPart === 'TEL' || keyPart.startsWith('TEL;')) {
      if (!current.phone) {
        current.phone = valPart.trim();
      }
    } else if (keyPart === 'NOTE' || keyPart.startsWith('NOTE;')) {
      if (!current.notes) {
        current.notes = unescapeVCard(valPart);
      }
    }
  }

  return contacts;
}

/**
 * Sérialise une liste de contacts au format CSV RFC 4180 avec BOM UTF-8.
 */
export function exportToCsv(contacts: Array<{ name: string; email: string; phone?: string; notes?: string }>): string {
  const rows = ['Nom,Email,Téléphone,Notes'];

  for (const c of contacts) {
    const fields = [
      escapeCsv(c.name || ''),
      escapeCsv(c.email || ''),
      escapeCsv(c.phone || ''),
      escapeCsv(c.notes || ''),
    ];
    rows.push(fields.join(','));
  }

  // Ajout du BOM UTF-8 (\uFEFF) pour compatibilité Excel
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Analyse un contenu CSV avec en-têtes (Nom, Email, Téléphone, Notes).
 */
export function parseCsv(content: string): ParsedContact[] {
  // Retrait de l'éventuel BOM
  const clean = content.startsWith('\uFEFF') ? content.slice(1) : content;
  const records = parseCsvRecords(clean);
  if (records.length < 2) return [];

  const header = records[0].map((h) => h.toLowerCase().trim());
  let nameIdx = -1;
  let emailIdx = -1;
  let phoneIdx = -1;
  let notesIdx = -1;

  header.forEach((col, idx) => {
    if (['nom', 'name', 'fullname', 'full name', 'display name'].includes(col)) nameIdx = idx;
    else if (['email', 'e-mail', 'courriel', 'adresse email'].includes(col)) emailIdx = idx;
    else if (['téléphone', 'telephone', 'phone', 'tel', 'mobile'].includes(col)) phoneIdx = idx;
    else if (['notes', 'note', 'commentaire', 'comments'].includes(col)) notesIdx = idx;
  });

  // Fallback si pas de correspondance exacte : 0=nom, 1=email, 2=tel, 3=notes
  if (emailIdx === -1) {
    emailIdx = 1;
    nameIdx = 0;
    phoneIdx = 2;
    notesIdx = 3;
  }

  const contacts: ParsedContact[] = [];

  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const email = row[emailIdx]?.trim();
    if (!email || !isValidEmail(email)) continue;

    const name = (nameIdx >= 0 ? row[nameIdx]?.trim() : '') || email;
    const phone = phoneIdx >= 0 ? row[phoneIdx]?.trim() : undefined;
    const notes = notesIdx >= 0 ? row[notesIdx]?.trim() : undefined;

    contacts.push({
      name,
      email: email.toLowerCase(),
      phone: phone || undefined,
      notes: notes || undefined,
    });
  }

  return contacts;
}

/** Parser CSV basique RFC 4180 gérant les guillemets et sauts de ligne */
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = '';
      } else if (char === '\r') {
        if (i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        row.push(field);
        field = '';
        records.push(row);
        row = [];
      } else if (char === '\n') {
        row.push(field);
        field = '';
        records.push(row);
        row = [];
      } else {
        field += char;
      }
    }
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  return records;
}

function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/**
 * Importe une liste de contacts parsés dans la base de données de l'utilisateur.
 * Dédoublonne par adresse email pour éviter les conflits (index unique userId+email).
 */
export async function importContacts(
  userId: string,
  contacts: ParsedContact[],
): Promise<ImportResult> {
  if (contacts.length === 0) {
    return { imported: 0, skipped: 0 };
  }

  // Récupère les emails existants pour cet utilisateur
  const existingContacts = await ContactModel.find({ userId }).select('email').lean();
  const existingEmails = new Set(existingContacts.map((c) => c.email.toLowerCase()));

  const toInsert: Array<{ userId: string; name: string; email: string; phone?: string; notes?: string }> = [];
  let skipped = 0;
  const seenInBatch = new Set<string>();

  for (const c of contacts) {
    const emailLower = c.email.toLowerCase();
    if (existingEmails.has(emailLower) || seenInBatch.has(emailLower)) {
      skipped++;
      continue;
    }

    seenInBatch.add(emailLower);
    toInsert.push({
      userId,
      name: c.name.trim() || c.email,
      email: emailLower,
      phone: c.phone,
      notes: c.notes,
    });
  }

  if (toInsert.length > 0) {
    await ContactModel.insertMany(toInsert, { ordered: false });
  }

  return {
    imported: toInsert.length,
    skipped,
  };
}
