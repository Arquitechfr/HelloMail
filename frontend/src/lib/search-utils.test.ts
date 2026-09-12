import { describe, it, expect } from "vitest";
import { buildSearchQueryString, type AdvancedSearchParams } from "./search-utils";

describe("search-utils", () => {
  describe("buildSearchQueryString", () => {
    it("retourne une chaîne vide si aucun filtre n'est renseigné", () => {
      expect(buildSearchQueryString({})).toBe("");
    });

    it("génère les opérateurs textuels simples", () => {
      const params: AdvancedSearchParams = {
        q: "facture",
        from: "alice@example.com",
        to: "bob@example.com",
        subject: "Rapport mensuel",
      };
      const res = buildSearchQueryString(params);
      expect(res).toBe("facture from:alice@example.com to:bob@example.com subject:Rapport mensuel");
    });

    it("génère les filtres d'état booléens", () => {
      const params: AdvancedSearchParams = {
        isUnread: true,
        isFlagged: true,
        isPinned: true,
        hasAttachment: true,
      };
      const res = buildSearchQueryString(params);
      expect(res).toBe("is:unread is:flagged is:pinned has:attachment");
    });

    it("génère les filtres de dates et de tailles", () => {
      const params: AdvancedSearchParams = {
        since: "2026-01-01",
        before: "2026-12-31",
        sizeOption: "larger5m",
      };
      const res = buildSearchQueryString(params);
      expect(res).toBe("since:2026-01-01 before:2026-12-31 larger:5M");
    });

    it("supporte les options de taille 1M et 10M", () => {
      expect(buildSearchQueryString({ sizeOption: "larger1m" })).toBe("larger:1M");
      expect(buildSearchQueryString({ sizeOption: "larger10m" })).toBe("larger:10M");
      expect(buildSearchQueryString({ sizeOption: "any" })).toBe("");
    });
  });
});
