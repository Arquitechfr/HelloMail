"use client";

import { useState, useEffect } from "react";

export type Breakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

export interface ScreenSize {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean; // < 768px (sm)
  isTablet: boolean; // 768px - 1023px (md)
  isDesktop: boolean; // 1024px - 1439px (lg)
  isWide: boolean; // >= 1440px (xl, 2xl) - grand écran
  isUltraWide: boolean; // >= 1920px (2xl+) - très grand écran
}

function getBreakpoint(width: number): Breakpoint {
  if (width < 768) return "sm";
  if (width < 1024) return "md";
  if (width < 1440) return "lg";
  if (width < 1920) return "xl";
  return "2xl";
}

function computeScreenSize(w: number, h: number): ScreenSize {
  const breakpoint = getBreakpoint(w);
  return {
    width: w,
    height: h,
    breakpoint,
    isMobile: w < 768,
    isTablet: w >= 768 && w < 1024,
    isDesktop: w >= 1024 && w < 1440,
    isWide: w >= 1440,
    isUltraWide: w >= 1920,
  };
}

const DEFAULT_SCREEN_SIZE: ScreenSize = {
  width: 1440,
  height: 900,
  breakpoint: "xl",
  isMobile: false,
  isTablet: false,
  isDesktop: false,
  isWide: true,
  isUltraWide: false,
};

/**
 * Hook de détection de taille d'écran réactif avec support SSR.
 * Met à jour dynamiquement les drapeaux isMobile, isTablet, isDesktop, isWide.
 */
export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = useState<ScreenSize>(() => {
    if (typeof window === "undefined") return DEFAULT_SCREEN_SIZE;
    return computeScreenSize(window.innerWidth, window.innerHeight);
  });

  useEffect(() => {
    let timeoutId: number | null = null;

    const handleResize = () => {
      if (timeoutId) window.cancelAnimationFrame(timeoutId);
      timeoutId = window.requestAnimationFrame(() => {
        setScreenSize(computeScreenSize(window.innerWidth, window.innerHeight));
      });
    };

    // Écoute de l'événement resize
    window.addEventListener("resize", handleResize, { passive: true });
    // Synchronisation immédiate après le montage
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (timeoutId) window.cancelAnimationFrame(timeoutId);
    };
  }, []);

  return screenSize;
}
