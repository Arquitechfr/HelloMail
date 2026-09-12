import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useComposeSignature } from "./useComposeSignature";
import type { Account } from "@/lib/api-types";

describe("useComposeSignature", () => {
  const baseAccount: Account = {
    _id: "acc-1",
    provider: "imap",
    emailAddress: "jean.dupont@mailora.me",
    displayName: "Jean Dupont",
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    signature: {
      enabled: true,
      text: "-- \n{{prenom}} {{nom}}\n{{poste}}\n{{email}}",
      variables: {
        jobTitle: "Directeur Technique",
        phone: "+33 6 00 00 00 00",
        company: "Mailora SAS",
      },
    },
    aliases: [
      {
        _id: "alias-1",
        email: "support@mailora.me",
        name: "Support HelMailoraloMail",
        isDefault: false,
        signature: {
          enabled: true,
          text: "-- \nL'équipe Support\n{{email}}",
        },
      },
    ],
  };

  it("insère automatiquement la signature avec les variables résolues pour un nouveau message", () => {
    let body = "";
    const setBody = vi.fn((updater) => {
      body = typeof updater === "function" ? updater(body) : updater;
    });

    renderHook(() =>
      useComposeSignature({
        currentAccount: baseAccount,
        activeSender: { name: "Jean Dupont", address: "jean.dupont@mailora.me" },
        mode: "new",
        body,
        setBody,
      }),
    );

    expect(setBody).toHaveBeenCalled();
    expect(body).toContain("Jean Dupont");
    expect(body).toContain("Directeur Technique");
    expect(body).toContain("jean.dupont@mailora.me");
    expect(body).toContain('data-signature="true"');
  });

  it("ne remplace pas la signature automatiquement si le mode n'est pas new", () => {
    let body = "";
    const setBody = vi.fn();

    renderHook(() =>
      useComposeSignature({
        currentAccount: baseAccount,
        activeSender: { address: "jean.dupont@mailora.me" },
        mode: "reply",
        body,
        setBody,
      }),
    );

    expect(setBody).not.toHaveBeenCalled();
  });

  it("met à jour dynamiquement la signature lors d'un changement d'expéditeur vers un alias", () => {
    let body = '<p>Bonjour,</p><div data-signature="true" class="mailora-signature"><p>-- </p><p>Jean Dupont</p><p>Directeur Technique</p><p>jean.dupont@mailora.me</p></div>';
    const setBody = vi.fn((updater) => {
      body = typeof updater === "function" ? updater(body) : updater;
    });

    const { rerender } = renderHook(
      ({ sender }) =>
        useComposeSignature({
          currentAccount: baseAccount,
          activeSender: sender,
          mode: "new",
          body,
          setBody,
          hasRestoredData: true,
        }),
      {
        initialProps: {
          sender: { name: "Jean Dupont", address: "jean.dupont@mailora.me" },
        },
      },
    );

    // Changement d'expéditeur vers l'alias support
    act(() => {
      rerender({
        sender: { name: "Support Mailora", address: "support@mailora.me" },
      });
    });

    expect(body).toContain("L'équipe Support");
    expect(body).toContain("support@mailora.me");
    expect(body).not.toContain("Directeur Technique");
  });

  it("insère manuellement la signature au clic sur le bouton", () => {
    let body = "<p>Message texte initial</p>";
    const setBody = vi.fn((updater) => {
      body = typeof updater === "function" ? updater(body) : updater;
    });

    const { result } = renderHook(() =>
      useComposeSignature({
        currentAccount: baseAccount,
        activeSender: { name: "Jean Dupont", address: "jean.dupont@mailora.me" },
        mode: "reply",
        body,
        setBody,
      }),
    );

    act(() => {
      result.current.handleInsertSignature();
    });

    expect(setBody).toHaveBeenCalled();
    expect(body).toContain("<p>Message texte initial</p>");
    expect(body).toContain('data-signature="true"');
    expect(body).toContain("Directeur Technique");
  });
});
