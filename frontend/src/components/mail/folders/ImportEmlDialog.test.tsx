import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ImportEmlDialog } from "./ImportEmlDialog";
import type { FolderInfo } from "@/lib/api-types";
import * as api from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe("ImportEmlDialog", () => {
  let queryClient: QueryClient;

  const mockFolder: FolderInfo = {
    path: "Archive/2024",
    name: "2024",
    delimiter: "/",
    flags: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof ImportEmlDialog>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ImportEmlDialog
          open={true}
          onOpenChange={vi.fn()}
          accountId="acc-123"
          folder={mockFolder}
          {...props}
        />
      </QueryClientProvider>,
    );
  };

  it("ne rend rien si folder est null", () => {
    const { container } = render(
      <QueryClientProvider client={queryClient}>
        <ImportEmlDialog
          open={true}
          onOpenChange={vi.fn()}
          accountId="acc-123"
          folder={null}
        />
      </QueryClientProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("affiche les détails du dialogue et le dossier cible", () => {
    renderComponent();
    expect(screen.getByText("Importer des messages (.eml)")).toBeInTheDocument();
    expect(screen.getByText("2024")).toBeInTheDocument();
    expect(screen.getByText(/Glissez-déposez vos fichiers/i)).toBeInTheDocument();
  });

  it("permet d'ajouter des fichiers .eml valides et de les supprimer", async () => {
    renderComponent();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    const validFile = new File(["From: test@example.com\n\nHello"], "test-message.eml", {
      type: "message/rfc822",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });

    expect(await screen.findByText("test-message.eml")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /importer \(1\)/i })).toBeInTheDocument();

    // Bouton de suppression du fichier
    const removeButton = screen.getByRole("button", { name: /retirer test-message.eml/i });
    await userEvent.click(removeButton);

    expect(screen.queryByText("test-message.eml")).not.toBeInTheDocument();
  });

  it("envoie les fichiers encodés en base64 au backend lors de l'importation", async () => {
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      success: true,
      message: "Message importé avec succès",
      uid: 101,
    });

    renderComponent({ onOpenChange, onSuccess });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const fileContent = "Subject: Facture\r\n\r\nMerci pour votre achat";
    const validFile = new File([fileContent], "facture.eml", {
      type: "message/rfc822",
    });

    fireEvent.change(fileInput, { target: { files: [validFile] } });
    expect(await screen.findByText("facture.eml")).toBeInTheDocument();

    const importButton = screen.getByRole("button", { name: /importer \(1\)/i });
    await userEvent.click(importButton);

    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        `/api/accounts/acc-123/messages/${encodeURIComponent("Archive/2024")}/import`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"isBase64":true'),
        }),
      );
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
