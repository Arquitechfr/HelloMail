import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PgpKeyManager } from "./PgpKeyManager";
import type { PgpKeyInfo } from "@/lib/api-types";

const mockDeleteUserKey = vi.fn();
const mockSaveUserKey = vi.fn();
const mockDeleteContactKey = vi.fn();

const mockUserKeys: PgpKeyInfo[] = [
  {
    email: "moncompte@hellomail.fr",
    name: "Mon Nom",
    armoredPublicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----",
    fingerprint: "1234567890ABCDEF1234567890ABCDEF12345678",
    keyId: "1234567890ABCDEF",
    algorithm: "Curve25519",
    isOwnKey: true,
  },
];

const mockContactKeys: PgpKeyInfo[] = [
  {
    email: "contact@externe.fr",
    name: "Ami PGP",
    armoredPublicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\ncontact\n-----END PGP PUBLIC KEY BLOCK-----",
    fingerprint: "AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJ",
    keyId: "AAAABBBBCCCCDDDD",
    algorithm: "Curve25519",
    isOwnKey: false,
  },
];

vi.mock("@/lib/queries/pgp", () => ({
  usePgpUserKeys: () => ({
    data: mockUserKeys,
    isLoading: false,
  }),
  useSavePgpUserKey: () => ({
    mutateAsync: mockSaveUserKey,
    isPending: false,
  }),
  useDeletePgpUserKey: () => ({
    mutate: mockDeleteUserKey,
    isPending: false,
  }),
  usePgpContactKeys: () => ({
    data: mockContactKeys,
    isLoading: false,
  }),
  useSavePgpContactKey: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useDeletePgpContactKey: () => ({
    mutate: mockDeleteContactKey,
    isPending: false,
  }),
}));

vi.mock("@/lib/queries/accounts", () => ({
  useAccounts: () => ({
    data: [{ _id: "acc-1", emailAddress: "moncompte@hellomail.fr" }],
  }),
}));

vi.mock("@/lib/pgp/pgpCrypto", () => ({
  isPgpEncrypted: (text: string) => /-----BEGIN PGP MESSAGE-----/i.test(text),
  isPgpSigned: (text: string) => /-----BEGIN PGP SIGNED MESSAGE-----/i.test(text),
  formatFingerprint: (fp: string) => fp ? fp.replace(/(.{4})/g, "$1 ").trim() : "",
  readPgpKeyInfo: vi.fn().mockResolvedValue({
    fingerprint: "TESTFINGERPRINT1234",
    keyId: "1234567890ABCDEF",
    algorithm: "Curve25519",
    userIds: ["User <user@test.com>"],
  }),
  generatePgpKeyPair: vi.fn().mockResolvedValue({
    armoredPublicKey: "-----BEGIN PGP PUBLIC KEY BLOCK-----\n...\n-----END PGP PUBLIC KEY BLOCK-----",
    armoredPrivateKey: "-----BEGIN PGP PRIVATE KEY BLOCK-----\n...\n-----END PGP PRIVATE KEY BLOCK-----",
    fingerprint: "NEWKEYFINGERPRINT123",
    keyId: "NEWKEY123",
  }),
  decryptPgpMessage: vi.fn(),
  encryptPgpMessage: vi.fn(),
  verifyPgpSignature: vi.fn(),
}));

describe("PgpKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche la clé OpenPGP personnelle et l'empreinte", () => {
    render(<PgpKeyManager />);

    expect(screen.getByText("Mes clés OpenPGP personnelles")).toBeInTheDocument();
    expect(screen.getByText("moncompte@hellomail.fr")).toBeInTheDocument();
    expect(screen.getByText(/Curve25519/)).toBeInTheDocument();
  });

  it("affiche la liste des clés publiques de correspondants", () => {
    render(<PgpKeyManager />);

    expect(screen.getByText(/Clés publiques des correspondants/)).toBeInTheDocument();
    expect(screen.getByText("contact@externe.fr")).toBeInTheDocument();
  });

  it("ouvre la modale de génération de clé au clic sur le bouton", async () => {
    render(<PgpKeyManager />);

    const generateBtn = screen.getByRole("button", { name: /Générer une clé/i });
    await userEvent.click(generateBtn);

    expect(
      screen.getByRole("heading", { name: /Générer une paire de clés OpenPGP/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Adresse email/i)).toBeInTheDocument();
  });

  it("permet de supprimer une clé personnelle", async () => {
    render(<PgpKeyManager />);

    const deleteBtn = screen.getByTitle("Supprimer la clé");
    await userEvent.click(deleteBtn);

    expect(mockDeleteUserKey).toHaveBeenCalledWith("1234567890ABCDEF");
  });
});
