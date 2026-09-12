import { describe, it, expect } from "vitest";
import { htmlToText, formatSignatureHtml, wrapSignatureContainer, replaceOrAppendSignature } from "./compose-utils";

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

  describe("signature container and replacement", () => {
    it("enrobe une signature dans le conteneur data-signature", () => {
      const wrapped = wrapSignatureContainer("<p>Signature</p>");
      expect(wrapped).toBe('<div data-signature="true" class="hellomail-signature"><p>Signature</p></div>');
    });

    it("ajoute la signature à la fin si absente", () => {
      const initial = "<p>Bonjour,</p>";
      const result = replaceOrAppendSignature(initial, "<p>Signé Alice</p>");
      expect(result).toContain("<p>Bonjour,</p>");
      expect(result).toContain('<div data-signature="true" class="hellomail-signature"><p>Signé Alice</p></div>');
    });

    it("remplace la signature existante lors d'un changement d'expéditeur", () => {
      const initial = '<p>Bonjour</p><div data-signature="true" class="hellomail-signature"><p>Signé Alice</p></div>';
      const result = replaceOrAppendSignature(initial, "<p>Signé Bob</p>");
      expect(result).toBe('<p>Bonjour</p><div data-signature="true" class="hellomail-signature"><p>Signé Bob</p></div>');
      expect(result).not.toContain("Alice");
    });

    it("retire la signature si la nouvelle est vide ou indéfinie", () => {
      const initial = '<p>Bonjour</p><div data-signature="true" class="hellomail-signature"><p>Signé Alice</p></div>';
      const result = replaceOrAppendSignature(initial, undefined);
      expect(result).toBe("<p>Bonjour</p>");
    });
  });
});
