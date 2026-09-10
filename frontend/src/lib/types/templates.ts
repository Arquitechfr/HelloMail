/**
 * Types pour la gestion des modèles d'emails et réponses types (Templates / Canned Responses).
 */

export interface EmailTemplate {
  id: string;
  userId: string;
  accountId?: string | null;
  title: string;
  subject?: string;
  bodyHtml: string;
  bodyText: string;
  shortcut?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  title: string;
  subject?: string;
  bodyHtml: string;
  bodyText?: string;
  shortcut?: string;
  accountId?: string | null;
  order?: number;
}

export interface UpdateTemplateInput {
  title?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
  shortcut?: string | null;
  accountId?: string | null;
  order?: number;
}
