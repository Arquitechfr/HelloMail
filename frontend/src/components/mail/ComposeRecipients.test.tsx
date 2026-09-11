import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComposeRecipients } from "./ComposeRecipients";
import type { Account, AccountAlias } from "@/lib/api-types";

const mockUseAccountAliases = vi.fn();

vi.mock("@/lib/queries/aliases", () => ({
  useAccountAliases: (accountId?: string) => mockUseAccountAliases(accountId),
}));

vi.mock("@/lib/queries/contacts", () => ({
  useSearchContacts: () => ({
    data: undefined,
    isLoading: false,
  }),
}));

describe("ComposeRecipients", () => {
  const mockAccount: Account = {
    _id: "acc-123",
    provider: "imap",
    emailAddress: "principal@hellomail.fr",
    displayName: "Jean Dupont",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche l'expéditeur statique sans sélecteur si aucun alias n'est configuré", () => {
    mockUseAccountAliases.mockReturnValue({ data: [], isLoading: false });

    render(
      <ComposeRecipients
        currentAccount={mockAccount}
        to="dest@test.com"
        onToChange={vi.fn()}
        cc=""
        onCcChange={vi.fn()}
        bcc=""
        onBccChange={vi.fn()}
        subject="Test"
        onSubjectChange={vi.fn()}
        showCcBcc={false}
        onToggleCcBcc={vi.fn()}
      />
    );

    expect(screen.getByText("De :")).toBeInTheDocument();
    expect(screen.getByText("Jean Dupont <principal@hellomail.fr>")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("affiche un menu déroulant pour choisir l'expéditeur si des alias existent", async () => {
    const aliases: AccountAlias[] = [
      {
        _id: "alias-1",
        name: "Support Pro",
        email: "support@hellomail.fr",
        isDefault: true,
      },
    ];
    mockUseAccountAliases.mockReturnValue({ data: aliases, isLoading: false });

    const onFromChange = vi.fn();

    render(
      <ComposeRecipients
        currentAccount={mockAccount}
        from={{ name: "Jean Dupont", address: "principal@hellomail.fr" }}
        onFromChange={onFromChange}
        to="dest@test.com"
        onToChange={vi.fn()}
        cc=""
        onCcChange={vi.fn()}
        bcc=""
        onBccChange={vi.fn()}
        subject="Test"
        onSubjectChange={vi.fn()}
        showCcBcc={false}
        onToggleCcBcc={vi.fn()}
      />
    );

    const select = screen.getByRole("combobox", {
      name: /Sélectionner l'expéditeur/i,
    });
    expect(select).toBeInTheDocument();

    await userEvent.selectOptions(select, "support@hellomail.fr");

    expect(onFromChange).toHaveBeenCalledWith({
      name: "Support Pro",
      address: "support@hellomail.fr",
    });
  });

  it("bascule l'affichage des champs Cc / Cci lors du clic sur le bouton", async () => {
    mockUseAccountAliases.mockReturnValue({ data: [], isLoading: false });
    const onToggleCcBcc = vi.fn();

    render(
      <ComposeRecipients
        currentAccount={mockAccount}
        to="dest@test.com"
        onToChange={vi.fn()}
        cc=""
        onCcChange={vi.fn()}
        bcc=""
        onBccChange={vi.fn()}
        subject="Test"
        onSubjectChange={vi.fn()}
        showCcBcc={false}
        onToggleCcBcc={onToggleCcBcc}
      />
    );

    const toggleBtn = screen.getByRole("button", { name: /Cc \/ Cci/i });
    await userEvent.click(toggleBtn);

    expect(onToggleCcBcc).toHaveBeenCalledTimes(1);
  });
});
