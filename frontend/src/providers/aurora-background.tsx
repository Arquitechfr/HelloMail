"use client";

/**
 * Fond aurora — gradient animé subtil derrière tout.
 * Matière pour le glass blur (le backdrop-filter a besoin d'un fond visuel).
 * Fixed, z-0, pointer-events: none.
 */
export function AuroraBackground({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="aurora-bg">
        <div className="aurora-bg-3" />
      </div>
      <div className="relative z-10">{children}</div>
    </>
  );
}
