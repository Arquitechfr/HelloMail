export type FollowUpReminderStatus =
  | 'pending'
  | 'triggered'
  | 'replied'
  | 'dismissed'
  | 'cancelled';

export interface FollowUpReminder {
  id: string;
  userId: string;
  accountId: string;
  messageId?: string;
  folder: string;
  uid: number;
  threadSubject: string;
  targetRecipient: string;
  remindAt: string;
  note?: string;
  status: FollowUpReminderStatus;
  triggeredAt?: string;
  repliedAt?: string;
  dismissedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReminderInput {
  remindAt: string;
  note?: string;
}

export interface PaginatedReminders {
  items: FollowUpReminder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
