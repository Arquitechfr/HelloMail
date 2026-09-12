import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PgpMessageBanner } from "./PgpMessageBanner";

const mockUserKeys = [
  {
    email: "dest@mailora.me",
    armoredPrivateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\ntest\n-----END PGP PRIVATE KEY BLOCK-----",
    armoredPublicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----",
  },
];

vi.mock("@/lib/queries/pgp", () => ({
  usePgpUserKeys: () => ({
    data: mockUserKeys,
    isLoading: false,
  }),
  usePgpContactPublicKey: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock("@/lib/pgp/pgpCrypto", () => ({
  isPgpEncrypted: (text: string) => /-----BEGIN PGP MESSAGE-----/i.test(text),
  isPgpSigned: (text: string) => /-----BEGIN PGP SIGNED MESSAGE-----/i.test(text),
  decryptPgpMessage: vi.fn().mockResolvedValue({
    decryptedText: "Contenu déchiffré sécurisé",
    isSigned: true,
    signatureValid: true,
  }),
  verifyPgpSignature: vi.fn().mockResolvedValue({
    isValid: true,
    keyId: "12345678",
  }),
}));

describe("PgpMessageBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne rend rien si le message est un texte brut sans PGP", () => {
    const { container } = render(
      <PgpMessageBanner
        content="Ceci est un email ordinaire non chiffré."
        senderEmail="alice@test.com"
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche la bannière de message chiffré si le contenu contient un bloc PGP MESSAGE", () => {
    render(
      <PgpMessageBanner
        content="-----BEGIN PGP MESSAGE-----\nhQGMA4...=\n-----END PGP MESSAGE-----"
        senderEmail="alice@test.com"
      />
    );

    expect(
      screen.getByText("Ce message est chiffré avec OpenPGP"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Déchiffrer/i })).toBeInTheDocument();
  });

  it("déchiffre le message et notifie le parent au clic sur Déchiffrer", async () => {
    const onDecrypted = vi.fn();

    render(
      <PgpMessageBanner
        content="-----BEGIN PGP MESSAGE-----\nhQGMA4...=\n-----END PGP MESSAGE-----"
        senderEmail="alice@test.com"
        onDecrypted={onDecrypted}
      />
    );

    const decryptBtn = screen.getByRole("button", { name: /Déchiffrer/i });
    await userEvent.click(decryptBtn);

    expect(onDecrypted).toHaveBeenCalledWith("Contenu déchiffré sécurisé");
    expect(
      await screen.findByText(/Message déchiffré de bout en bout/i),
    ).toBeInTheDocument();
  });

  it("affiche la bannière de message signé pour un message signé en clair", () => {
    render(
      <PgpMessageBanner
        content="-----BEGIN PGP SIGNED MESSAGE-----\nHash: SHA256\n\nBonjour\n-----BEGIN PGP SIGNATURE-----\n..."
        senderEmail="alice@test.com"
      />
    );

    expect(
      screen.getByText("Message signé numériquement (OpenPGP)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Vérifier la signature/i }),
    ).toBeInTheDocument();
  });
});
