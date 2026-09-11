import { describe, it, expect } from "vitest";
import {
  isProtectedFolder,
  getParentPath,
  getBaseFolderName,
  buildSubFolderPath,
  validateFolderName,
} from "./folder-utils";

describe("folder-utils", () => {
  describe("isProtectedFolder", () => {
    it("détecte INBOX comme protégé indépendamment de la casse", () => {
      expect(isProtectedFolder({ path: "INBOX" })).toBe(true);
      expect(isProtectedFolder({ path: "inbox" })).toBe(true);
      expect(isProtectedFolder({ path: "Inbox" })).toBe(true);
    });

    it("détecte les dossiers système avec specialUse comme protégés", () => {
      expect(isProtectedFolder({ path: "Sent Messages", specialUse: "\\Sent" })).toBe(true);
      expect(isProtectedFolder({ path: "Trash", specialUse: "\\Trash" })).toBe(true);
      expect(isProtectedFolder({ path: "Archive", specialUse: "\\Archive" })).toBe(true);
    });

    it("détecte les noms canoniques de dossiers système comme protégés", () => {
      expect(isProtectedFolder({ path: "Corbeille" })).toBe(true);
      expect(isProtectedFolder({ path: "brouillons" })).toBe(true);
      expect(isProtectedFolder({ path: "envoyés" })).toBe(true);
      expect(isProtectedFolder({ path: "spam" })).toBe(true);
      expect(isProtectedFolder({ path: "Snoozed" })).toBe(true);
    });

    it("considère les dossiers personnalisés comme non protégés", () => {
      expect(isProtectedFolder({ path: "Projets" })).toBe(false);
      expect(isProtectedFolder({ path: "Clients/Factures" })).toBe(false);
      expect(isProtectedFolder({ path: "Perso" })).toBe(false);
    });
  });

  describe("getParentPath", () => {
    it("extrait le chemin parent avec le délimiteur", () => {
      expect(getParentPath("Work/Clients/HelloMail", "/")).toBe("Work/Clients");
      expect(getParentPath("Work/Clients", "/")).toBe("Work");
      expect(getParentPath("Work.Clients", ".")).toBe("Work");
    });

    it("retourne null s'il n'y a pas de parent", () => {
      expect(getParentPath("Work", "/")).toBeNull();
      expect(getParentPath("INBOX", "/")).toBeNull();
    });
  });

  describe("getBaseFolderName", () => {
    it("extrait le nom court du dossier", () => {
      expect(getBaseFolderName("Work/Clients", "/")).toBe("Clients");
      expect(getBaseFolderName("Work.Clients", ".")).toBe("Clients");
      expect(getBaseFolderName("SimpleFolder", "/")).toBe("SimpleFolder");
    });
  });

  describe("buildSubFolderPath", () => {
    it("construit le chemin complet du sous-dossier", () => {
      expect(buildSubFolderPath("Work", "Clients", "/")).toBe("Work/Clients");
      expect(buildSubFolderPath("Work", "Clients", ".")).toBe("Work.Clients");
      expect(buildSubFolderPath(null, "Work", "/")).toBe("Work");
    });
  });

  describe("validateFolderName", () => {
    it("valide les noms corrects", () => {
      expect(validateFolderName("Projets", "/")).toBeNull();
      expect(validateFolderName("Factures-2026", "/")).toBeNull();
    });

    it("rejette les noms vides ou avec espaces", () => {
      expect(validateFolderName("", "/")).toContain("requis");
      expect(validateFolderName("   ", "/")).toContain("requis");
    });

    it("rejette les noms contenant le délimiteur", () => {
      expect(validateFolderName("Projets/Sub", "/")).toContain("délimiteur");
      expect(validateFolderName("Projets.Sub", ".")).toContain("délimiteur");
    });

    it("rejette le nom réservé INBOX", () => {
      expect(validateFolderName("INBOX", "/")).toContain("réservé");
      expect(validateFolderName("inbox", "/")).toContain("réservé");
    });
  });
});
