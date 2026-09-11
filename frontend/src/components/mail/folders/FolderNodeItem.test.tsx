import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderNodeItem, type FolderNode } from "./FolderNodeItem";

vi.mock("@/lib/queries/messages", () => ({
  useMoveMessage: () => ({ mutate: vi.fn(), isPending: false }),
}));

function makeNode(overrides: Partial<FolderNode> = {}): FolderNode {
  return {
    path: "Projets",
    name: "Projets",
    delimiter: "/",
    flags: [],
    children: [],
    ...overrides,
  };
}

function renderNode(node: FolderNode, selectedFolder = "") {
  const onSelectFolder = vi.fn();
  render(
    <FolderNodeItem
      node={node}
      depth={0}
      selectedFolder={selectedFolder}
      accountId="acc1"
      onSelectFolder={onSelectFolder}
      onCreateSubfolder={vi.fn()}
      onRename={vi.fn()}
      onDelete={vi.fn()}
      onImportEml={vi.fn()}
    />,
  );
  return { onSelectFolder };
}

describe("FolderNodeItem", () => {
  it("sélectionne le path réel pour un dossier standard", async () => {
    const { onSelectFolder } = renderNode(makeNode());

    await userEvent.click(screen.getByText("Projets"));

    expect(onSelectFolder).toHaveBeenCalledWith("Projets");
  });

  it("canonicalise la boîte de réception localisée (\\Inbox) vers INBOX", async () => {
    const node = makeNode({
      path: "Boîte de réception",
      name: "Boîte de réception",
      specialUse: "\\Inbox",
    });
    const { onSelectFolder } = renderNode(node);

    await userEvent.click(screen.getByText("Boîte de réception"));

    expect(onSelectFolder).toHaveBeenCalledWith("INBOX");
  });

  it("ne canonicalise pas les autres dossiers spéciaux localisés", async () => {
    const node = makeNode({
      path: "Envoyé",
      name: "Envoyé",
      specialUse: "\\Sent",
    });
    const { onSelectFolder } = renderNode(node);

    await userEvent.click(screen.getByText("Envoyé"));

    expect(onSelectFolder).toHaveBeenCalledWith("Envoyé");
  });
});
