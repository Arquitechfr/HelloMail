import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EmptyFolderDialog } from "./EmptyFolderDialog";
import * as api from "@/lib/api";

const mockInvalidateQueries = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (args: unknown) => Promise<unknown>;
    onSuccess?: (data: unknown, variables: unknown) => void;
  }) => ({
    mutate: (vars: unknown, options?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      mutationFn(vars)
        .then((res) => {
          onSuccess?.(res, vars);
          options?.onSuccess?.(res);
        })
        .catch((err) => {
          options?.onError?.(err);
        });
    },
    isPending: false,
  }),
}));

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EmptyFolderDialog", () => {
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le titre et bouton adaptés pour la Corbeille", () => {
    render(
      <EmptyFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folderPath="Trash"
        folderName="Corbeille"
        messageCount={15}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Vider la corbeille ?")).toBeInTheDocument();
    expect(screen.getByText(/15/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vider la corbeille" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Annuler" })).toBeInTheDocument();
  });

  it("affiche le titre adapté pour un dossier de courriers indésirables", () => {
    render(
      <EmptyFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folderPath="Junk"
        folderName="Spams"
        messageCount={0}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Vider le dossier « Spams » ?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vider le dossier" })).toBeInTheDocument();
  });

  it("exécute le vidage au clic et déclenche onSuccess", async () => {
    vi.mocked(api.apiFetch).mockResolvedValueOnce({
      message: "Dossier vidé",
      deletedCount: 12,
    });

    render(
      <EmptyFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folderPath="Trash"
        folderName="Corbeille"
        messageCount={12}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Vider la corbeille" }));

    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith(
        "/api/accounts/acc-1/folders/Trash/empty",
        expect.objectContaining({ method: "POST" })
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("ferme le dialogue au clic sur Annuler", () => {
    render(
      <EmptyFolderDialog
        open={true}
        onOpenChange={onOpenChange}
        accountId="acc-1"
        folderPath="Trash"
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(api.apiFetch).not.toHaveBeenCalled();
  });
});
