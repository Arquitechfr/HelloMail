import { describe, it, expect } from "vitest";
import {
  getFileExtension,
  getAttachmentCategory,
  isAttachmentPreviewable,
  getAttachmentIcon,
  getCategoryBadgeClasses,
  getLanguageFromFilename,
} from "./attachment-utils";

describe("attachment-utils", () => {
  describe("getFileExtension", () => {
    it("extrait l'extension en minuscules", () => {
      expect(getFileExtension("photo.PNG")).toBe("png");
      expect(getFileExtension("archive.tar.gz")).toBe("gz");
      expect(getFileExtension("README")).toBe("");
      expect(getFileExtension(".gitignore")).toBe("gitignore");
    });
  });

  describe("getAttachmentCategory", () => {
    it("identifie les PDF", () => {
      expect(getAttachmentCategory("application/pdf", "rapport.pdf")).toBe("pdf");
      expect(getAttachmentCategory("application/octet-stream", "rapport.pdf")).toBe("pdf");
    });

    it("identifie les images", () => {
      expect(getAttachmentCategory("image/jpeg", "avatar.jpg")).toBe("image");
      expect(getAttachmentCategory("image/png", "image.png")).toBe("image");
      expect(getAttachmentCategory("image/svg+xml", "logo.svg")).toBe("image");
      expect(getAttachmentCategory("application/octet-stream", "photo.webp")).toBe("image");
    });

    it("identifie les audios et vidéos", () => {
      expect(getAttachmentCategory("audio/mpeg", "son.mp3")).toBe("audio");
      expect(getAttachmentCategory("video/mp4", "video.mp4")).toBe("video");
      expect(getAttachmentCategory("application/octet-stream", "track.wav")).toBe("audio");
    });

    it("identifie le texte et le code", () => {
      expect(getAttachmentCategory("text/plain", "notes.txt")).toBe("text");
      expect(getAttachmentCategory("application/json", "config.json")).toBe("text");
      expect(getAttachmentCategory("application/octet-stream", "script.ts")).toBe("text");
      expect(getAttachmentCategory("text/markdown", "guide.md")).toBe("text");
    });

    it("identifie les tableurs, documents et présentations", () => {
      expect(getAttachmentCategory("application/vnd.ms-excel", "budget.xls")).toBe("spreadsheet");
      expect(getAttachmentCategory("application/msword", "cv.docx")).toBe("document");
      expect(getAttachmentCategory("application/vnd.ms-powerpoint", "slides.pptx")).toBe(
        "presentation",
      );
    });

    it("identifie les archives et les autres types inconnus", () => {
      expect(getAttachmentCategory("application/zip", "bundle.zip")).toBe("archive");
      expect(getAttachmentCategory("application/octet-stream", "firmware.bin")).toBe("other");
    });
  });

  describe("isAttachmentPreviewable", () => {
    it("considère les formats pris en charge comme prévisualisables", () => {
      expect(isAttachmentPreviewable("image/png", "test.png")).toBe(true);
      expect(isAttachmentPreviewable("application/pdf", "test.pdf")).toBe(true);
      expect(isAttachmentPreviewable("text/plain", "test.txt")).toBe(true);
      expect(isAttachmentPreviewable("audio/mp3", "test.mp3")).toBe(true);
      expect(isAttachmentPreviewable("video/mp4", "test.mp4")).toBe(true);
    });

    it("considère les archives et binaires comme non prévisualisables", () => {
      expect(isAttachmentPreviewable("application/zip", "test.zip")).toBe(false);
      expect(isAttachmentPreviewable("application/octet-stream", "app.exe")).toBe(false);
    });
  });

  describe("getAttachmentIcon & getCategoryBadgeClasses", () => {
    it("fournit une icône pour chaque catégorie sans planter", () => {
      expect(getAttachmentIcon("image")).toBeDefined();
      expect(getAttachmentIcon("pdf")).toBeDefined();
      expect(getAttachmentIcon("other")).toBeDefined();
    });

    it("fournit des classes CSS adaptées pour les pastilles", () => {
      expect(getCategoryBadgeClasses("image")).toContain("emerald");
      expect(getCategoryBadgeClasses("pdf")).toContain("rose");
      expect(getCategoryBadgeClasses("text")).toContain("amber");
    });
  });

  describe("getLanguageFromFilename", () => {
    it("déduit la syntaxe correcte de coloration", () => {
      expect(getLanguageFromFilename("app.tsx")).toBe("typescript");
      expect(getLanguageFromFilename("server.js")).toBe("javascript");
      expect(getLanguageFromFilename("data.json")).toBe("json");
      expect(getLanguageFromFilename("script.py")).toBe("python");
      expect(getLanguageFromFilename("style.css")).toBe("css");
      expect(getLanguageFromFilename("doc.unknown")).toBe("plaintext");
    });
  });
});
