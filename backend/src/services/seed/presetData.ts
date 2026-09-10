import type { IRuleCondition, IRuleAction, RuleConditionMatch } from '../../models/Rule.js';

/**
 * Contenu prédéfini (presets) semé automatiquement pour chaque utilisateur.
 * Les règles n'utilisent que des actions sûres : applyTag, markAsRead, markAsFlagged.
 */

export interface PresetTag {
  name: string;
  color: string;
}

export interface PresetRule {
  name: string;
  conditionMatch: RuleConditionMatch;
  conditions: IRuleCondition[];
  actions: IRuleAction[];
  stopProcessing: boolean;
}

export interface PresetTemplate {
  title: string;
  subject: string;
  bodyHtml: string;
  shortcut: string;
}

export const PRESET_TAGS: PresetTag[] = [
  { name: 'Important', color: '#ef4444' },
  { name: 'Travail', color: '#3b82f6' },
  { name: 'Personnel', color: '#10b981' },
  { name: 'Factures', color: '#f59e0b' },
  { name: 'À traiter', color: '#f97316' },
  { name: 'Newsletters', color: '#8b5cf6' },
  { name: 'Promotions', color: '#ec4899' },
  { name: 'Réseaux sociaux', color: '#06b6d4' },
];

export const PRESET_RULES: PresetRule[] = [
  {
    name: 'Newsletters & notifications',
    conditionMatch: 'any',
    conditions: [
      { field: 'from', operator: 'contains', value: 'newsletter' },
      { field: 'from', operator: 'contains', value: 'noreply' },
      { field: 'from', operator: 'contains', value: 'no-reply' },
      { field: 'from', operator: 'contains', value: 'notifications' },
    ],
    actions: [{ type: 'applyTag', tagName: 'Newsletters' }, { type: 'markAsRead' }],
    stopProcessing: false,
  },
  {
    name: 'Réseaux sociaux',
    conditionMatch: 'any',
    conditions: [
      { field: 'from', operator: 'contains', value: 'facebook' },
      { field: 'from', operator: 'contains', value: 'linkedin' },
      { field: 'from', operator: 'contains', value: 'twitter' },
      { field: 'from', operator: 'contains', value: 'instagram' },
      { field: 'from', operator: 'contains', value: 'tiktok' },
    ],
    actions: [{ type: 'applyTag', tagName: 'Réseaux sociaux' }, { type: 'markAsRead' }],
    stopProcessing: false,
  },
  {
    name: 'Promotions & soldes',
    conditionMatch: 'any',
    conditions: [
      { field: 'subject', operator: 'contains', value: 'promo' },
      { field: 'subject', operator: 'contains', value: 'soldes' },
      { field: 'subject', operator: 'contains', value: 'réduction' },
      { field: 'subject', operator: 'contains', value: 'offre' },
    ],
    actions: [{ type: 'applyTag', tagName: 'Promotions' }, { type: 'markAsRead' }],
    stopProcessing: false,
  },
  {
    name: 'Factures & paiements',
    conditionMatch: 'any',
    conditions: [
      { field: 'subject', operator: 'contains', value: 'facture' },
      { field: 'subject', operator: 'contains', value: 'invoice' },
      { field: 'subject', operator: 'contains', value: 'reçu' },
      { field: 'subject', operator: 'contains', value: 'receipt' },
      { field: 'subject', operator: 'contains', value: 'paiement' },
    ],
    actions: [{ type: 'applyTag', tagName: 'Factures' }, { type: 'markAsFlagged' }],
    stopProcessing: false,
  },
];

export const PRESET_TEMPLATES: PresetTemplate[] = [
  {
    title: 'Accusé de réception',
    subject: '',
    shortcut: 'reception',
    bodyHtml:
      '<p>Bonjour,</p><p>J\'ai bien reçu votre message et je vous répondrai dans les plus brefs délais.</p><p>Cordialement,</p>',
  },
  {
    title: 'Relance sans réponse',
    subject: '',
    shortcut: 'relance',
    bodyHtml:
      '<p>Bonjour,</p><p>Je me permets de revenir vers vous concernant mon précédent message, resté sans réponse.</p><p>Pourriez-vous me faire un retour lorsque vous en aurez la possibilité ?</p><p>Merci d\'avance,<br>Cordialement,</p>',
  },
  {
    title: 'Absence du bureau',
    subject: 'Absence du bureau',
    shortcut: 'absence',
    bodyHtml:
      '<p>Bonjour,</p><p>Je suis actuellement absent(e) du bureau et n\'ai pas accès à mes emails.</p><p>Je traiterai votre message à mon retour. Pour toute urgence, merci de contacter mon équipe.</p><p>Cordialement,</p>',
  },
  {
    title: 'Remerciement',
    subject: '',
    shortcut: 'merci',
    bodyHtml:
      '<p>Bonjour,</p><p>Merci beaucoup pour votre message et les informations transmises.</p><p>Cordialement,</p>',
  },
  {
    title: 'Refus poli',
    subject: '',
    shortcut: 'refus',
    bodyHtml:
      '<p>Bonjour,</p><p>Je vous remercie pour votre proposition. Après réflexion, je ne pourrai malheureusement pas y donner suite pour le moment.</p><p>Je vous souhaite une excellente continuation.</p><p>Cordialement,</p>',
  },
  {
    title: "Demande d'information",
    subject: '',
    shortcut: 'info',
    bodyHtml:
      '<p>Bonjour,</p><p>Je souhaiterais obtenir davantage d\'informations concernant le sujet évoqué.</p><p>Pourriez-vous m\'en dire davantage ?</p><p>Merci d\'avance,<br>Cordialement,</p>',
  },
];
