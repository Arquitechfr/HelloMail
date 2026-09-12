import { describe, it, expect } from "vitest";
import { hasAttachmentMention } from "./attachment-detector";

describe("attachment-detector (hasAttachmentMention)", () => {
  it("détecte les mentions explicites en français dans le corps", () => {
    expect(hasAttachmentMention("Bonjour", "Veuillez trouver ci-joint mon devis")).toBe(true);
    expect(hasAttachmentMention("Contrat", "Je vous joins le document signé.")).toBe(true);
    expect(hasAttachmentMention("Compte-rendu", "Le fichier est en PJ.")).toBe(true);
    expect(hasAttachmentMention("Dossier", "Vous trouverez la pièce jointe ci-dessous.")).toBe(true);
    expect(hasAttachmentMention("Note", "Document disponible en annexe.")).toBe(true);
  });

  it("détecte les mentions dans le sujet", () => {
    expect(hasAttachmentMention("Pièce jointe : facture mai", "Voici pour régularisation")).toBe(true);
    expect(hasAttachmentMention("Fichier ci-joint", "Bonne réception.")).toBe(true);
  });

  it("détecte les mentions en anglais", () => {
    expect(hasAttachmentMention("Report", "Please find attached the quarterly results.")).toBe(true);
    expect(hasAttachmentMention("Invoice", "The invoice is attached.")).toBe(true);
    expect(hasAttachmentMention("Doc", "See attached for details.")).toBe(true);
    expect(hasAttachmentMention("Contract", "Please review the attached contract.")).toBe(true);
  });

  it("détecte les mentions au sein de balises HTML", () => {
    expect(
      hasAttachmentMention(
        "Projet",
        "<p>Bonjour,</p><p>Veuillez trouver <strong>ci-joint</strong> le document.</p>",
      ),
    ).toBe(true);
  });

  it("ignore les faux positifs avec négation explicite", () => {
    expect(hasAttachmentMention("Envoi", "Message sans pièce jointe, tout est dans le corps.")).toBe(false);
    expect(hasAttachmentMention("Note", "Pas de pièce jointe pour ce rappel.")).toBe(false);
    expect(hasAttachmentMention("Notice", "This email has no attachment.")).toBe(false);
  });

  it("ignore les mentions situées dans les citations d'anciens messages", () => {
    const replyBody = `
Bonjour, bien reçu votre demande.

> Le 12 mai 2026, Alice a écrit :
> Veuillez trouver ci-joint le rapport.
    `;
    expect(hasAttachmentMention("Re: Rapport", replyBody)).toBe(false);
  });

  it("retourne false si aucun mot clé n'est présent", () => {
    expect(hasAttachmentMention("Réunion demain", "Es-tu disponible à 14h pour faire un point ?")).toBe(false);
    expect(hasAttachmentMention("Merci", "Merci pour ton aide sur ce sujet.")).toBe(false);
  });
});
