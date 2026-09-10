import type { LucideIcon } from "lucide-react";
import {
  Mail,
  PenLine,
  Sparkles,
  Filter,
  Tag as TagIcon,
  ShieldCheck,
  Users,
  Bell,
  Sliders,
  Layers,
} from "lucide-react";

export type SettingsSectionId =
  | "accounts"
  | "signatures"
  | "templates"
  | "rules"
  | "tags"
  | "security"
  | "contacts"
  | "notifications"
  | "appearance"
  | "all";

export interface SettingsItemConfig {
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  badgeKey?: "accounts" | "templates" | "rules" | "tags" | "contacts" | "twoFactor";
}

export interface SettingsGroupConfig {
  title: string;
  items: SettingsItemConfig[];
}

export const SETTINGS_GROUPS: SettingsGroupConfig[] = [
  {
    title: "Compte & Sécurité",
    items: [
      {
        id: "accounts",
        label: "Profil & Comptes",
        description: "Comptes IMAP, OAuth et identifiants",
        icon: Mail,
        badgeKey: "accounts",
      },
      {
        id: "security",
        label: "Sécurité & 2FA",
        description: "Double authentification et passkeys",
        icon: ShieldCheck,
        badgeKey: "twoFactor",
      },
    ],
  },
  {
    title: "Messagerie & Rédaction",
    items: [
      {
        id: "signatures",
        label: "Signatures",
        description: "Signatures personnalisées par compte",
        icon: PenLine,
      },
      {
        id: "templates",
        label: "Modèles d'emails",
        description: "Réponses types et modèles réutilisables",
        icon: Sparkles,
        badgeKey: "templates",
      },
    ],
  },
  {
    title: "Organisation & Tri",
    items: [
      {
        id: "rules",
        label: "Règles & Filtres",
        description: "Actions automatiques sur les emails entrants",
        icon: Filter,
        badgeKey: "rules",
      },
      {
        id: "tags",
        label: "Libellés & Étiquettes",
        description: "Organisation colorée des messages",
        icon: TagIcon,
        badgeKey: "tags",
      },
      {
        id: "contacts",
        label: "Carnet d'adresses",
        description: "Contacts et autocomplétion",
        icon: Users,
        badgeKey: "contacts",
      },
    ],
  },
  {
    title: "Système & Préférences",
    items: [
      {
        id: "notifications",
        label: "Notifications & Son",
        description: "Alertes bureau et carillon audio",
        icon: Bell,
      },
      {
        id: "appearance",
        label: "Affichage & Envoi",
        description: "Thème, temps réel et délai d'annulation",
        icon: Sliders,
      },
      {
        id: "all",
        label: "Tout afficher",
        description: "Vue complète en défilement continu",
        icon: Layers,
      },
    ],
  },
];
