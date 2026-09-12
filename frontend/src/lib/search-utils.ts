export interface AdvancedSearchParams {
  q?: string;
  from?: string;
  to?: string;
  subject?: string;
  folder?: string;
  accountId?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isFlagged?: boolean;
  isPinned?: boolean;
  since?: string;
  before?: string;
  sizeOption?: "any" | "larger1m" | "larger5m" | "larger10m";
  includeTrashSpam?: boolean;
}

/**
 * Construit la query string avec opérateurs reconnus par le moteur de recherche backend.
 */
export function buildSearchQueryString(params: AdvancedSearchParams): string {
  const parts: string[] = [];
  if (params.q?.trim()) parts.push(params.q.trim());
  if (params.from?.trim()) parts.push(`from:${params.from.trim()}`);
  if (params.to?.trim()) parts.push(`to:${params.to.trim()}`);
  if (params.subject?.trim()) parts.push(`subject:${params.subject.trim()}`);
  if (params.isUnread) parts.push("is:unread");
  if (params.isFlagged) parts.push("is:flagged");
  if (params.isPinned) parts.push("is:pinned");
  if (params.hasAttachment) parts.push("has:attachment");
  if (params.since) parts.push(`since:${params.since}`);
  if (params.before) parts.push(`before:${params.before}`);
  if (params.sizeOption === "larger1m") parts.push("larger:1M");
  else if (params.sizeOption === "larger5m") parts.push("larger:5M");
  else if (params.sizeOption === "larger10m") parts.push("larger:10M");
  return parts.join(" ");
}
