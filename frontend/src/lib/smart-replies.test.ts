import { describe, it, expect } from "vitest";
import { generateSmartReplies } from "./smart-replies";

describe("smart-replies (generateSmartReplies)", () => {
  it("génère des réponses de politesse sur un message de remerciement", () => {
    const replies = generateSmartReplies("Super boulot", "Merci beaucoup pour ton retour rapide !");
    expect(replies).toEqual(["De rien !", "Avec grand plaisir !", "À votre service !"]);
  });

  it("génère des réponses de validation sur une demande d'accord", () => {
    const replies = generateSmartReplies("Proposition tarifaire", "Peux-tu me confirmer si tu es d'accord avec ce devis ?");
    expect(replies).toEqual([
      "C'est validé pour moi.",
      "D'accord, c'est noté !",
      "Je regarde et je vous confirme.",
    ]);
  });

  it("génère des réponses adaptées à une proposition de réunion ou d'appel", () => {
    const replies = generateSmartReplies("Point d'équipe", "Seriez-vous dispo pour un call demain à 10h ?");
    expect(replies).toEqual([
      "Disponible, c'est parfait pour moi.",
      "Je vous recontacte pour convenir d'un créneau.",
      "Entendu, à bientôt !",
    ]);
  });

  it("génère des réponses d'accusé de réception sur l'envoi d'un document", () => {
    const replies = generateSmartReplies("Facture acquittée", "Voici la facture ci-joint pour votre comptabilité.");
    expect(replies).toEqual([
      "Bien reçu, merci !",
      "Merci pour le document.",
      "Je regarde ça dès que possible.",
    ]);
  });

  it("génère des réponses générales sur une question avec point d'interrogation", () => {
    const replies = generateSmartReplies("Avancement", "Où en est le déploiement sur la staging ?");
    expect(replies).toEqual([
      "Bien reçu, je m'en occupe.",
      "Je regarde ça et je reviens vers vous.",
      "Merci pour l'information.",
    ]);
  });

  it("retourne les réponses par défaut sur un message vide ou indéfini", () => {
    const replies = generateSmartReplies("", "");
    expect(replies).toEqual([
      "Bien reçu, merci !",
      "Merci beaucoup !",
      "Excellente journée à vous.",
    ]);
  });
});
