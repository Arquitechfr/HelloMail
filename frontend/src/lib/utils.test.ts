import { describe, it, expect } from "vitest";
import { formatDate, formatSize, getInitials } from "./utils";

describe("utils", () => {
  describe("formatDate", () => {
    it("formate une date ISO en format court français", () => {
      expect(formatDate("2026-01-15T10:00:00Z")).toBe("15 janv. 2026");
    });
  });

  describe("formatSize", () => {
    it("formate les octets", () => {
      expect(formatSize(512)).toBe("512 o");
      expect(formatSize(2048)).toBe("2.0 Ko");
      expect(formatSize(2 * 1024 * 1024)).toBe("2.0 Mo");
    });
  });

  describe("getInitials", () => {
    it("extrait les initiales d'un nom complet", () => {
      expect(getInitials("Alice Martin")).toBe("AM");
    });

    it("extrait les initiales d'un email", () => {
      expect(getInitials(undefined, "alice.martin@test.com")).toBe("AM");
    });

    it("retourne les 2 premiers caractères pour un nom seul", () => {
      expect(getInitials("Alice")).toBe("AL");
    });

    it("retourne '?' par défaut", () => {
      expect(getInitials()).toBe("?");
    });
  });
});
