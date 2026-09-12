import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageListHeader } from "./MessageListHeader";

vi.mock("@/lib/queries/folders", () => ({
  useEmptyFolder: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("./SearchBar", () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock("./DensitySelector", () => ({
  DensitySelector: () => <div data-testid="density-selector" />,
}));

vi.mock("./folders/EmptyFolderDialog", () => ({
  EmptyFolderDialog: ({ open, folderPath }: { open: boolean; folderPath: string }) =>
    open ? <div data-testid="empty-folder-dialog">Dialog for {folderPath}</div> : null,
}));

describe("MessageListHeader", () => {
  it("affiche le titre du dossier et le total sans bouton vider pour INBOX", () => {
    render(
      <MessageListHeader
        folder="INBOX"
        total={42}
        isFetching={false}
        accountId="acc-1"
        onResults={vi.fn()}
      />
    );

    expect(screen.getByText("INBOX")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.queryByTitle("Vider la corbeille")).not.toBeInTheDocument();
  });

  it("affiche le bouton Vider pour le dossier Corbeille avec des messages", () => {
    render(
      <MessageListHeader
        folder="Trash"
        total={10}
        isFetching={false}
        accountId="acc-1"
        onResults={vi.fn()}
      />
    );

    expect(screen.getByText("Trash")).toBeInTheDocument();
    const emptyBtn = screen.getByTitle("Vider la corbeille");
    expect(emptyBtn).toBeInTheDocument();

    fireEvent.click(emptyBtn);
    expect(screen.getByTestId("empty-folder-dialog")).toBeInTheDocument();
    expect(screen.getByText("Dialog for Trash")).toBeInTheDocument();
  });

  it("n'affiche pas le bouton Vider si la corbeille est déjà vide", () => {
    render(
      <MessageListHeader
        folder="Trash"
        total={0}
        isFetching={false}
        accountId="acc-1"
        onResults={vi.fn()}
      />
    );

    expect(screen.queryByTitle("Vider la corbeille")).not.toBeInTheDocument();
  });
});
