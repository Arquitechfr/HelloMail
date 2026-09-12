import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountSignatureManager } from "./AccountSignatureManager";
import type { Account } from "@/lib/api-types";

const mockUpdateSignatureMutate = vi.fn();
const mockUpdateAliasSignatureMutate = vi.fn();

const mockAccounts: Account[] = [
  {
    _id: "acc-1",
    provider: "imap",
    emailAddress: "alice@hellomail.fr",
    displayName: "Alice Durant",
    isActive: true,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    signature: {
      enabled: true,
      text: "-- \n{{nom_complet}}\n{{poste}}\n{{email}}",
      variables: {
        jobTitle: "Directrice",
        phone: "+33 6 11 22 33 44",
        company: "HelloMail",
      },
    },
    aliases: [
      {
        _id: "alias-1",
        email: "contact@hellomail.fr",
        name: "Contact HelloMail",
        isDefault: false,
        signature: {
          enabled: false,
          text: "",
        },
      },
    ],
  },
];

vi.mock("@/lib/queries/accounts", () => ({
  useAccounts: () => ({
    data: mockAccounts,
    isLoading: false,
  }),
  useUpdateSignature: () => ({
    mutate: mockUpdateSignatureMutate,
    isPending: false,
  }),
  useUpdateAliasSignature: () => ({
    mutate: mockUpdateAliasSignatureMutate,
    isPending: false,
  }),
}));

describe("AccountSignatureManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le compte et l'indicateur d'alias", () => {
    render(<AccountSignatureManager />);
    expect(screen.getAllByText("alice@hellomail.fr").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alice Durant").length).toBeGreaterThan(0);
    expect(screen.getByText("1 alias configuré")).toBeInTheDocument();
  });

  it("affiche les boutons d'insertion de variables", () => {
    render(<AccountSignatureManager />);
    expect(screen.getByText(/Insérer une variable en 1 clic/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Prénom/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Téléphone/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\+ Poste/i })).toBeInTheDocument();
  });

  it("insère une variable dans le textarea au clic sur son badge", async () => {
    const user = userEvent.setup();
    render(<AccountSignatureManager />);

    const textarea = screen.getByPlaceholderText(/Bien cordialement/i) as HTMLTextAreaElement;

    const phoneBtn = screen.getByRole("button", { name: /\+ Téléphone/i });
    await user.click(phoneBtn);

    expect(textarea.value).toContain("{{telephone}}");
  });

  it("permet de basculer vers l'onglet de l'alias", async () => {
    const user = userEvent.setup();
    render(<AccountSignatureManager />);

    const aliasBtn = screen.getByRole("button", { name: /contact@hellomail\.fr/i });
    await user.click(aliasBtn);

    expect(screen.getByText("Activer la signature pour cet alias")).toBeInTheDocument();
  });

  it("enregistre la signature du compte principal", async () => {
    const user = userEvent.setup();
    render(<AccountSignatureManager />);

    const saveBtn = screen.getByRole("button", { name: /Enregistrer/i });
    await user.click(saveBtn);

    expect(mockUpdateSignatureMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "acc-1",
        signature: expect.objectContaining({
          enabled: true,
          text: expect.stringContaining("{{nom_complet}}"),
        }),
      }),
      expect.any(Object),
    );
  });
});
