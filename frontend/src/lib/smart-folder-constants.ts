import type React from "react";
import {
  Sparkles,
  Inbox,
  Star,
  Bookmark,
  FileText,
  Receipt,
  Tag,
  AlertCircle,
  Zap,
  Clock,
  Flame,
  Shield,
} from "lucide-react";

export const SMART_FOLDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  Inbox,
  Star,
  Bookmark,
  FileText,
  Receipt,
  Tag,
  AlertCircle,
  Zap,
  Clock,
  Flame,
  Shield,
};

export const COLOR_PALETTE = [
  "#3b82f6", // Bleu
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#ec4899", // Rose
  "#ef4444", // Rouge
  "#f59e0b", // Ambre
  "#10b981", // Émeraude
  "#06b6d4", // Cyan
];

export const QUERY_HELPERS = [
  { label: "+ Non lus", snippet: "is:unread" },
  { label: "+ Épinglés", snippet: "is:pinned" },
  { label: "+ Important", snippet: "is:flagged" },
  { label: "+ Avec PJ", snippet: "has:attachment" },
  { label: "+ De...", snippet: "from:@" },
  { label: "+ Sujet...", snippet: "subject:" },
];
