"use client";

import * as React from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";

export interface EmailAvatarProps {
  email?: string | null;
  name?: string | null;
  domain?: string | null;
  className?: string;
  fallbackClassName?: string;
  imageClassName?: string;
  size?: "default" | "sm" | "lg";
  alt?: string;
}

/**
 * Extrait le domaine pour la recherche de logo.
 * Exemple: "support@stripe.com" -> "stripe.com".
 */
function extractDomain(emailOrDomain?: string | null): string | null {
  if (!emailOrDomain) return null;
  const trimmed = emailOrDomain.trim().toLowerCase();

  const atIndex = trimmed.lastIndexOf("@");
  if (atIndex !== -1) {
    const domainPart = trimmed.slice(atIndex + 1).split("/")[0].trim();
    return domainPart.includes(".") ? domainPart : null;
  }

  const cleaned = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim();

  return cleaned.includes(".") ? cleaned : null;
}

/**
 * Composant Avatar intelligent d'HelloMail.
 *
 * Tente d'afficher le logo officiel de l'expéditeur ou du compte via l'API Logo.dev
 * (proxifiée et mise en cache côté backend sur /api/logos/:domain).
 *
 * Si le logo est indisponible, introuvable (404) ou en cours de chargement,
 * bascule gracieusement et instantanément sur l'avatar aux initiales textuelles.
 */
export function EmailAvatar({
  email,
  name,
  domain: directDomain,
  className,
  fallbackClassName,
  imageClassName,
  size = "default",
  alt,
}: EmailAvatarProps) {
  const domain = directDomain || extractDomain(email);
  const initials = getInitials(name ?? undefined, email ?? undefined);
  const logoUrl = domain ? `/api/logos/${encodeURIComponent(domain)}` : undefined;

  return (
    <Avatar size={size} className={cn("overflow-hidden shrink-0", className)}>
      {logoUrl && (
        <AvatarImage
          src={logoUrl}
          alt={alt ?? name ?? email ?? "Logo"}
          className={cn(
            "aspect-square size-full object-contain p-0.5 bg-background/50 transition-opacity duration-150",
            imageClassName,
          )}
        />
      )}
      <AvatarFallback
        className={cn(
          "bg-primary/10 text-primary font-semibold select-none",
          fallbackClassName,
        )}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
