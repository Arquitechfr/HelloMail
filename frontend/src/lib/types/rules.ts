/**
 * Types pour les règles de tri automatique.
 */

export type RuleConditionField = "from" | "to" | "subject" | "hasAttachments";
export type RuleConditionOperator = "contains" | "notContains" | "equals" | "startsWith" | "endsWith";
export type RuleConditionMatch = "all" | "any";

export interface RuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
}

export type RuleActionType =
  | "moveToFolder"
  | "markAsRead"
  | "markAsFlagged"
  | "markAsJunk"
  | "delete"
  | "applyTag"
  | "pinMessage";

export interface RuleAction {
  type: RuleActionType;
  folderName?: string;
  tagName?: string;
}

export interface MailRule {
  _id: string;
  userId: string;
  accountId?: string;
  name: string;
  order: number;
  isActive: boolean;
  conditionMatch: RuleConditionMatch;
  conditions: RuleCondition[];
  actions: RuleAction[];
  stopProcessing: boolean;
  isPreset?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRuleInput {
  name: string;
  accountId?: string;
  isActive?: boolean;
  conditionMatch?: RuleConditionMatch;
  conditions: RuleCondition[];
  actions: RuleAction[];
  stopProcessing?: boolean;
}

export type UpdateRuleInput = Partial<CreateRuleInput>;
