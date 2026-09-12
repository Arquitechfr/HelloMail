import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StorageQuotaBar } from "./StorageQuotaBar";

const mockUseAccountQuota = vi.fn();
const mockMutate = vi.fn();
const mockUseRefreshAccountQuota = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock("@/lib/queries/accounts", () => ({
  useAccountQuota: (...args: unknown[]) => mockUseAccountQuota(...args),
  useRefreshAccountQuota: () => mockUseRefreshAccountQuota(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("StorageQuotaBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne rend rien si accountId est absent ou quota non supporté", () => {
    mockUseAccountQuota.mockReturnValue({ data: null, isLoading: false });
    const { container: c1 } = render(<StorageQuotaBar accountId={null} />);
    expect(c1).toBeEmptyDOMElement();

    mockUseAccountQuota.mockReturnValue({
      data: { supported: false },
      isLoading: false,
    });
    const { container: c2 } = render(<StorageQuotaBar accountId="acc1" />);
    expect(c2).toBeEmptyDOMElement();
  });

  it("affiche la jauge, le pourcentage et les tailles formatées", () => {
    mockUseAccountQuota.mockReturnValue({
      data: {
        supported: true,
        usedBytes: 1073741824, // 1 Go
        totalBytes: 2147483648, // 2 Go
        percentage: 50,
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
    });

    render(<StorageQuotaBar accountId="acc1" />);

    expect(screen.getByText("Stockage")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("1.0 Go")).toBeInTheDocument();
    expect(screen.getByText("2.0 Go")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });

  it("affiche l'alerte d'espace saturé quand le quota dépasse 90%", () => {
    mockUseAccountQuota.mockReturnValue({
      data: {
        supported: true,
        usedBytes: 1932735283,
        totalBytes: 2147483648,
        percentage: 92,
        updatedAt: new Date().toISOString(),
      },
      isLoading: false,
    });

    render(<StorageQuotaBar accountId="acc1" />);

    expect(screen.getByText("Espace saturé")).toBeInTheDocument();
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveClass("bg-rose-500");
  });

  it("déclenche la mutation de rafraîchissement au clic sur le bouton", async () => {
    mockUseAccountQuota.mockReturnValue({
      data: {
        supported: true,
        usedBytes: 500000,
        totalBytes: 1000000,
        percentage: 50,
      },
      isLoading: false,
    });

    render(<StorageQuotaBar accountId="acc1" />);

    const refreshBtn = screen.getByRole("button", { name: /Rafraîchir le quota IMAP/i });
    await userEvent.click(refreshBtn);

    expect(mockMutate).toHaveBeenCalledWith("acc1", expect.any(Object));
  });
});
