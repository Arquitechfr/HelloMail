import type { SignatureVariables } from './api-types';

export interface SignatureContext {
  displayName?: string;
  emailAddress: string;
  variables?: SignatureVariables;
}

export interface SignatureVariableDef {
  key: string;
  label: string;
  placeholder: string;
  example: string;
}

export const AVAILABLE_SIGNATURE_VARIABLES: readonly SignatureVariableDef[] = [
  { key: '{{prenom}}', label: 'Prénom', placeholder: '{{prenom}}', example: 'Jean' },
  { key: '{{nom}}', label: 'Nom', placeholder: '{{nom}}', example: 'Dupont' },
  { key: '{{nom_complet}}', label: 'Nom complet', placeholder: '{{nom_complet}}', example: 'Jean Dupont' },
  { key: '{{email}}', label: 'Email', placeholder: '{{email}}', example: 'jean.dupont@example.com' },
  { key: '{{telephone}}', label: 'Téléphone', placeholder: '{{telephone}}', example: '+33 6 12 34 56 78' },
  { key: '{{poste}}', label: 'Poste', placeholder: '{{poste}}', example: 'Directeur Général' },
  { key: '{{societe}}', label: 'Société', placeholder: '{{societe}}', example: 'Acme SAS' },
] as const;

/**
 * Résout les variables dynamiques contenues dans une signature email (texte ou HTML).
 * Gère {{nom}}, {{prenom}}, {{email}}, {{telephone}}, {{poste}}, {{societe}}
 * ainsi que leurs alias courants (tel, phone, entreprise, company, jobTitle).
 */
export function resolveSignatureVariables(content: string, context: SignatureContext): string {
  if (!content) return '';

  const rawDisplayName = context.displayName?.trim() || '';
  const parts = rawDisplayName ? rawDisplayName.split(/\s+/) : [];
  const prenom = parts.length > 0 ? parts[0] : '';
  const hasPrenomVar = /\{\{\s*(?:prenom|firstname)\s*\}\}/i.test(content);
  const nom = parts.length > 1 && hasPrenomVar ? parts.slice(1).join(' ') : rawDisplayName;
  const nomComplet = rawDisplayName || context.emailAddress.split('@')[0];

  const map: Record<string, string> = {
    prenom,
    firstname: prenom,
    nom,
    lastname: nom,
    nom_complet: nomComplet,
    nomcomplet: nomComplet,
    fullname: nomComplet,
    email: context.emailAddress,
    telephone: context.variables?.phone || '',
    tel: context.variables?.phone || '',
    phone: context.variables?.phone || '',
    poste: context.variables?.jobTitle || '',
    titre: context.variables?.jobTitle || '',
    jobtitle: context.variables?.jobTitle || '',
    societe: context.variables?.company || '',
    entreprise: context.variables?.company || '',
    company: context.variables?.company || '',
  };

  return content.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (match, key: string) => {
    const lower = key.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, lower)) {
      return map[lower];
    }
    return match;
  });
}
