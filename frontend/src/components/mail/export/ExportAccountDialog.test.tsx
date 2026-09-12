import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportAccountDialog } from "./ExportAccountDialog";
import * as exportUtils from "@/lib/export-utils";

vi.mock("@/lib/queries/folders", () => ({
  useFolders: vi.fn().mockReturnValue({
    data: [
      { name: "Boîte de réception", path: "INBOX", status: { messages: 42 } },
      { name: "Envoyés", path: "Sent", status: { messages: 15 } },
    ],
    isLoading: false,
  }),
}));

vi.mock("@/lib/export-utils", () => ({
  downloadExportFile: vi.fn().mockResolvedValue(undefined),
}));

describe("ExportAccountDialog", () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche les formats d'exportation disponibles quand il est ouvert", () => {
    render(
      <ExportAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-123"
      />
    );

    expect(screen.getByText("Exporter et archiver les courriels")).toBeInTheDocument();
    expect(screen.getByText(/Archive ZIP/i)).toBeInTheDocument();
    expect(screen.getByText(/Dossier \(\.mbox\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /démarrer l'exportation/i })).toBeInTheDocument();
  });

  it("bascule sur le format mbox et affiche le sélecteur de dossier", () => {
    render(
      <ExportAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-123"
      />
    );

    fireEvent.click(screen.getByText(/Dossier \(\.mbox\)/i));

    expect(screen.getByText("Dossier à exporter :")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("déclenche downloadExportFile lors du clic sur démarrer l'exportation", async () => {
    render(
      <ExportAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-123"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /démarrer l'exportation/i }));

    await waitFor(() => {
      expect(exportUtils.downloadExportFile).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: "acc-123",
          format: "zip",
        })
      );
    });
  });

  it("initialise en mode mbox si initialFolder est renseigné", () => {
    render(
      <ExportAccountDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-123"
        initialFolder="Sent"
      />
    );

    expect(screen.getByText("Dossier à exporter :")).toBeInTheDocument();
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("Sent");
  });
});
