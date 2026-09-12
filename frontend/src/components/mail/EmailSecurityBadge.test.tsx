import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmailSecurityBadge } from "./EmailSecurityBadge";
import type { EmailSecuritySummary } from "@/lib/api-types";

describe("EmailSecurityBadge", () => {
  it("affiche le badge 'Expéditeur vérifié' quand isTrusted est true", () => {
    const summary: EmailSecuritySummary = {
      spf: "pass",
      dkim: "pass",
      dmarc: "pass",
      isTrusted: true,
      isSpam: false,
    };

    render(<EmailSecurityBadge summary={summary} senderEmail="trusted@example.com" />);

    expect(screen.getByText("Expéditeur vérifié")).toBeInTheDocument();
  });

  it("affiche le badge 'Alerte de sécurité' quand un contrôle échoue", () => {
    const summary: EmailSecuritySummary = {
      spf: "fail",
      dkim: "fail",
      dmarc: "fail",
      isTrusted: false,
      warningMessage: "Échec d'authentification DMARC",
    };

    render(<EmailSecurityBadge summary={summary} senderEmail="attacker@evil.com" />);

    expect(screen.getByText("Alerte de sécurité")).toBeInTheDocument();
  });

  it("ouvre le popover au clic et affiche les détails DMARC, DKIM, SPF", () => {
    const summary: EmailSecuritySummary = {
      spf: "pass",
      dkim: "pass",
      dmarc: "pass",
      isTrusted: true,
      spamScore: -1.2,
    };

    render(<EmailSecurityBadge summary={summary} senderEmail="test@domain.com" />);

    const button = screen.getByRole("button", { name: /expéditeur vérifié/i });
    fireEvent.click(button);

    expect(screen.getByText("Sécurité de l'expéditeur")).toBeInTheDocument();
    expect(screen.getByText("test@domain.com")).toBeInTheDocument();
    expect(screen.getByText("DMARC")).toBeInTheDocument();
    expect(screen.getByText("DKIM (Signature)")).toBeInTheDocument();
    expect(screen.getByText("SPF (Autorisation)")).toBeInTheDocument();
    expect(screen.getByText("-1.2")).toBeInTheDocument();
  });

  it("affiche 'Non vérifié' si aucun en-tête d'authentification n'est présent", () => {
    render(<EmailSecurityBadge senderEmail="unknown@domain.com" />);

    expect(screen.getByText("Non vérifié")).toBeInTheDocument();
  });
});
