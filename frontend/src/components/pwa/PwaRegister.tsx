"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    // N'enregistrer le SW qu'après le chargement complet pour ne pas pénaliser le LCP initial
    const registerSw = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Détecte une nouvelle version disponible
        registration.addEventListener("updatefound", () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener("statechange", () => {
            if (
              installingWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              toast.info("Une nouvelle version de HelloMail est prête", {
                action: {
                  label: "Recharger",
                  onClick: () => window.location.reload(),
                },
                duration: 8000,
              });
            }
          });
        });
      } catch (error) {
        // En local ou sous HTTP non sécurisé, l'échec est normal et non bloquant
        if (process.env.NODE_ENV === "development") {
          console.debug("[PWA] Enregistrement SW en dev:", error);
        }
      }
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw);
      return () => window.removeEventListener("load", registerSw);
    }
  }, []);

  return null;
}
