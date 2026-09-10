"use client";

import React from "react";
import { X } from "lucide-react";

interface TagBadgeProps {
  name: string;
  color?: string;
  size?: "sm" | "md";
  onRemove?: () => void;
  className?: string;
}

export function TagBadge({
  name,
  color = "#3b82f6",
  size = "sm",
  onRemove,
  className = "",
}: TagBadgeProps) {
  const isSm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full transition-all select-none ${
        isSm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${className}`}
      style={{
        backgroundColor: `${color}1a`, // 10% opacity
        color: color,
        border: `1px solid ${color}40`, // 25% opacity
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <span className="truncate max-w-[120px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-75 focus:outline-none ml-0.5 rounded-full"
          title={`Retirer l'étiquette ${name}`}
          aria-label={`Retirer ${name}`}
        >
          <X className={isSm ? "w-2.5 h-2.5" : "w-3 h-3"} />
        </button>
      )}
    </span>
  );
}
