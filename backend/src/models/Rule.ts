import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type RuleConditionField = 'from' | 'to' | 'subject' | 'hasAttachments';
export type RuleConditionOperator = 'contains' | 'notContains' | 'equals' | 'startsWith' | 'endsWith';
export type RuleConditionMatch = 'all' | 'any';

export interface IRuleCondition {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
}

export type RuleActionType = 'moveToFolder' | 'markAsRead' | 'markAsFlagged' | 'markAsJunk' | 'delete' | 'applyTag';

export interface IRuleAction {
  type: RuleActionType;
  folderName?: string;
  tagName?: string;
}

export interface IRule {
  userId: Types.ObjectId;
  accountId?: Types.ObjectId;
  name: string;
  order: number;
  isActive: boolean;
  conditionMatch: RuleConditionMatch;
  conditions: IRuleCondition[];
  actions: IRuleAction[];
  stopProcessing: boolean;
  isPreset: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type RuleDocument = Document<Types.ObjectId, object, IRule> & IRule;

const ruleConditionSchema = new Schema<IRuleCondition>(
  {
    field: {
      type: String,
      enum: ['from', 'to', 'subject', 'hasAttachments'],
      required: true,
    },
    operator: {
      type: String,
      enum: ['contains', 'notContains', 'equals', 'startsWith', 'endsWith'],
      required: true,
    },
    value: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: false },
);

const ruleActionSchema = new Schema<IRuleAction>(
  {
    type: {
      type: String,
      enum: ['moveToFolder', 'markAsRead', 'markAsFlagged', 'markAsJunk', 'delete', 'applyTag'],
      required: true,
    },
    folderName: {
      type: String,
      trim: true,
    },
    tagName: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const ruleSchema = new Schema<IRule>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: 'Account',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    conditionMatch: {
      type: String,
      enum: ['all', 'any'],
      default: 'all',
    },
    conditions: {
      type: [ruleConditionSchema],
      required: true,
      validate: [(val: IRuleCondition[]) => val.length > 0, 'Au moins une condition est requise'],
    },
    actions: {
      type: [ruleActionSchema],
      required: true,
      validate: [(val: IRuleAction[]) => val.length > 0, 'Au moins une action est requise'],
    },
    stopProcessing: {
      type: Boolean,
      default: false,
    },
    isPreset: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

ruleSchema.index({ userId: 1, order: 1 });

export const RuleModel = mongoose.model<IRule>('Rule', ruleSchema);
