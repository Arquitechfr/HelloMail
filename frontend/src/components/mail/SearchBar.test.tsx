import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBar } from "./SearchBar";

const mockUseSearch = vi.fn();

vi.mock("@/lib/queries/messages", () => ({
  useSearch: (...args: unknown[]) => mockUseSearch(...args),
}));

function mockSearchResult(data: unknown = { data: [], source: "local" }, isFetching = false) {
  mockUseSearch.mockReturnValue({ data, isFetching });
}

describe("SearchBar", () => {
  beforeEach(() => {
    mockSearchResult();
  });

  it("affiche le placeholder avec les opérateurs", () => {
    render(<SearchBar accountId="acc1" onResults={vi.fn()} />);
    expect(screen.getByPlaceholderText(/Filtrer/)).toBeInTheDocument();
  });

  it("notifie le parent des résultats après debounce", async () => {
    const onResults = vi.fn();
    mockSearchResult({ data: [{ uid: 1 }], source: "local" });
    render(<SearchBar accountId="acc1" onResults={onResults} />);

    await userEvent.type(screen.getByPlaceholderText(/Filtrer/), "test");

    await waitFor(() => expect(onResults).toHaveBeenCalledWith([{ uid: 1 }]), {
      timeout: 1000,
    });
  });

  it("affiche le badge 'serveur' quand la recherche vient d'IMAP", async () => {
    mockSearchResult({ data: [{ uid: 1 }], source: "server" });
    render(<SearchBar accountId="acc1" onResults={vi.fn()} />);

    await userEvent.type(screen.getByPlaceholderText(/Filtrer/), "test");

    await waitFor(() => expect(screen.getByText("serveur")).toBeInTheDocument(), {
      timeout: 1000,
    });
  });

  it("n'affiche pas le badge pour une recherche locale", () => {
    mockSearchResult({ data: [{ uid: 1 }], source: "local" });
    render(<SearchBar accountId="acc1" onResults={vi.fn()} />);
    expect(screen.queryByText("serveur")).not.toBeInTheDocument();
  });
});
