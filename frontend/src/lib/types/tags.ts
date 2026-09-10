/**
 * Types pour les libellés et étiquettes colorés (Tags).
 */

export interface MailTag {
  id: string;
  userId: string;
  name: string;
  color: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  order?: number;
}

export type UpdateTagInput = Partial<CreateTagInput>;

export interface BatchSetMessageTagsInput {
  folder: string;
  uids: number[];
  tags: string[];
  mode?: 'set' | 'add' | 'remove';
}
