"use client";

import { cn } from "@/lib/utils";

/**
 * GlassPanel — wrapper réutilisable pour les panneaux glass.
 * Utilise la classe utilitaire `.glass` (définie dans globals.css).
 */
interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "strong";
}

export function GlassPanel({
  className,
  variant = "default",
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        variant === "strong" ? "glass-strong" : "glass",
        "rounded-2xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
