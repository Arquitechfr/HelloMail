import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileBackupSection } from "./ProfileBackupSection";
import * as profileQueries from "@/lib/queries/profile";

vi.mock("@/lib/queries/profile", () => ({
  downloadProfileBackup: vi.fn(),
  usePreviewProfile: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  useRestoreProfile: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

describe("ProfileBackupSection (Lot 30.6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les cartes d exportation et de restauration de profil", () => {
    render(<ProfileBackupSection />);

    expect(screen.getByText(/Sauvegarder mon profil Mailora/i)).toBeInTheDocument();
    expect(screen.getByText(/Restaurer une sauvegarde de profil/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Télécharger mon profil \(\.json\)/i })).toBeInTheDocument();
    expect(screen.getByText(/Glissez-déposez votre fichier de sauvegarde ici/i)).toBeInTheDocument();
  });

  it("révèle le champ de mot de passe quand le chiffrement est activé", () => {
    render(<ProfileBackupSection />);

    const checkbox = screen.getByLabelText(/Chiffrer la sauvegarde avec un mot de passe/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(screen.getByPlaceholderText(/Définir un mot de passe de protection.../i)).toBeInTheDocument();
  });

  it("déclenche downloadProfileBackup au clic sur le bouton de téléchargement", async () => {
    render(<ProfileBackupSection />);

    const downloadBtn = screen.getByRole("button", { name: /Télécharger mon profil \(\.json\)/i });
    fireEvent.click(downloadBtn);

    expect(profileQueries.downloadProfileBackup).toHaveBeenCalledWith(false, undefined);
  });
});
