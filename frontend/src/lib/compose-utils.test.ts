import { describe, it, expect } from "vitest";
import { htmlToText, formatSignatureHtml } from "./compose-utils";

describe("compose-utils", () => {
  describe("htmlToText", () => {
    it("convertit du HTML en texte brut", () => {
      expect(htmlToText("<p>Bonjour <b>monde</b></p>")).toBe("Bonjour monde");
    });

    it("gère le HTML vide", () => {
      expect(htmlToText("")).toBe("");
    });
  });

  describe("formatSignatureHtml", () => {
    it("formate une signature en blocs de paragraphes", () => {
      const result = formatSignatureHtml("Alice\nDev");
      expect(result).toContain("<p>Alice</p>");
      expect(result).toContain("<p>Dev</p>");
      // Préfixe "-- " standard de signature ajouté si absent.
      expect(result).toContain("<p>-- </p>");
    });

    it("ne duplique pas le séparateur -- existant", () => {
      const result = formatSignatureHtml("-- \nAlice");
      expect(result.match(/--/g)).toHaveLength(1);
    });

    it("préserve les lignes vides avec <br>", () => {
      const result = formatSignatureHtml("Alice\n\nDev");
      expect(result).toContain("<p><br></p>");
    });
  });
});
