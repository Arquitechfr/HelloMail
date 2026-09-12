import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderContextMenu } from "./FolderContextMenu";
import type { FolderInfo } from "@/lib/api-types";

describe("FolderContextMenu", () => {
  const customFolder: FolderInfo = {
    path: "Projets",
    name: "Projets",
    delimiter: "/",
    flags: [],
  };

  const inboxFolder: FolderInfo = {
    path: "INBOX",
    name: "INBOX",
    delimiter: "/",
    specialUse: "\\Inbox",
    flags: [],
  };

  it("affiche l'indication protégé pour INBOX au clic droit", async () => {
    const handleCreateSubfolder = vi.fn();
    const handleRename = vi.fn();
    const handleDelete = vi.fn();
    const handleImportEml = vi.fn();

    render(
      <FolderContextMenu
        folder={inboxFolder}
        onCreateSubfolder={handleCreateSubfolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onImportEml={handleImportEml}
      >
        <div data-testid="inbox-row">INBOX</div>
      </FolderContextMenu>,
    );

    const trigger = screen.getByTestId("inbox-row");
    fireEvent.contextMenu(trigger);

    expect(await screen.findByText("Dossier système protégé")).toBeInTheDocument();
    expect(screen.queryByText("Renommer")).not.toBeInTheDocument();
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();

    const importItem = screen.getByText("Importer (.eml)");
    await userEvent.click(importItem);
    expect(handleImportEml).toHaveBeenCalledWith(inboxFolder);

    fireEvent.contextMenu(trigger);
    const createSubItem = screen.getByText("Nouveau sous-dossier");
    await userEvent.click(createSubItem);
    expect(handleCreateSubfolder).toHaveBeenCalledWith(inboxFolder);
  });

  it("permet de renommer et supprimer un dossier personnalisé au clic droit", async () => {
    const handleCreateSubfolder = vi.fn();
    const handleRename = vi.fn();
    const handleDelete = vi.fn();

    render(
      <FolderContextMenu
        folder={customFolder}
        onCreateSubfolder={handleCreateSubfolder}
        onRename={handleRename}
        onDelete={handleDelete}
        onImportEml={vi.fn()}
      >
        <div data-testid="folder-row">Projets</div>
      </FolderContextMenu>,
    );

    const trigger = screen.getByTestId("folder-row");
    fireEvent.contextMenu(trigger);

    const renameItem = await screen.findByText("Renommer");
    expect(renameItem).toBeInTheDocument();
    await userEvent.click(renameItem);
    expect(handleRename).toHaveBeenCalledWith(customFolder);
  });

  it("permet de déclencher la suppression d'un dossier personnalisé", async () => {
    const handleDelete = vi.fn();

    render(
      <FolderContextMenu
        folder={customFolder}
        onCreateSubfolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={handleDelete}
        onImportEml={vi.fn()}
      >
        <div data-testid="folder-row-delete">Projets</div>
      </FolderContextMenu>,
    );

    const trigger = screen.getByTestId("folder-row-delete");
    fireEvent.contextMenu(trigger);

    const deleteItem = await screen.findByText("Supprimer");
    expect(deleteItem).toBeInTheDocument();
    await userEvent.click(deleteItem);
    expect(handleDelete).toHaveBeenCalledWith(customFolder);
  });

  it("affiche l'action Vider le dossier pour la Corbeille au clic droit", async () => {
    const handleEmpty = vi.fn();
    const trashFolder: FolderInfo = {
      path: "Trash",
      name: "Trash",
      delimiter: "/",
      specialUse: "\\Trash",
      flags: [],
    };

    render(
      <FolderContextMenu
        folder={trashFolder}
        onCreateSubfolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImportEml={vi.fn()}
        onEmpty={handleEmpty}
      >
        <div data-testid="trash-row">Trash</div>
      </FolderContextMenu>,
    );

    const trigger = screen.getByTestId("trash-row");
    fireEvent.contextMenu(trigger);

    const emptyItem = await screen.findByText("Vider le dossier");
    expect(emptyItem).toBeInTheDocument();
    await userEvent.click(emptyItem);
    expect(handleEmpty).toHaveBeenCalledWith(trashFolder);
  });
});

