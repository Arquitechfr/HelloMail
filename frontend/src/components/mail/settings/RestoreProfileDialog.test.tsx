import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RestoreProfileDialog } from "./RestoreProfileDialog";
import * as profileQueries from "@/lib/queries/profile";

vi.mock("@/lib/queries/profile", () => ({
  usePreviewProfile: vi.fn(),
  useRestoreProfile: vi.fn(),
}));

describe("RestoreProfileDialog (Lot 30.5)", () => {
  const mockMutatePreview = vi.fn();
  const mockMutateRestore = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(profileQueries.usePreviewProfile).mockReturnValue({
      mutate: mockMutatePreview,
      isPending: false,
    } as unknown as ReturnType<typeof profileQueries.usePreviewProfile>);

    vi.mocked(profileQueries.useRestoreProfile).mockReturnValue({
      mutate: mockMutateRestore,
      isPending: false,
    } as unknown as ReturnType<typeof profileQueries.useRestoreProfile>);
  });

  it("déclenche l analyse automatique d un profil en clair à l ouverture", () => {
    const backupData = {
      metadata: { version: "1.0", exportedAt: "2026-09-12", userEmail: "test@example.com" },
      tags: [{ name: "Urgent", color: "#f00" }],
    };

    render(
      <RestoreProfileDialog
        open={true}
        onOpenChange={vi.fn()}
        backupData={backupData}
      />,
    );

    expect(mockMutatePreview).toHaveBeenCalledWith(
      { backupData },
      expect.any(Object),
    );
  });

  it("affiche la demande de mot de passe si la sauvegarde est chiffrée", () => {
    const encryptedData = {
      version: "1.0",
      format: "mailora-encrypted-profile",
      algorithm: "aes-256-gcm",
      ciphertext: "abcd",
    };

    render(
      <RestoreProfileDialog
        open={true}
        onOpenChange={vi.fn()}
        backupData={encryptedData}
      />,
    );

    expect(screen.getByText(/Cette sauvegarde est chiffrée par mot de passe/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Votre mot de passe.../i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Déchiffrer et inspecter/i })).toBeInTheDocument();
  });
});
