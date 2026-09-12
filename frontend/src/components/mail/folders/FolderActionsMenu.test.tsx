import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FolderActionsMenu } from "./FolderActionsMenu";
import type { FolderInfo } from "@/lib/api-types";

describe("FolderActionsMenu", () => {
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

  it("affiche l'indication protégé pour INBOX et permet de créer un sous-dossier", async () => {
    const handleCreateSubfolder = vi.fn();

    render(
      <FolderActionsMenu
        folder={inboxFolder}
        accountId="acc-1"
        onCreateSubfolder={handleCreateSubfolder}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImportEml={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: /Actions pour le dossier INBOX/i });
    await userEvent.click(trigger);

    expect(await screen.findByText("Dossier système protégé")).toBeInTheDocument();
    expect(screen.queryByText("Renommer")).not.toBeInTheDocument();
    expect(screen.queryByText("Supprimer")).not.toBeInTheDocument();

    const createSubBtn = screen.getByText("Nouveau sous-dossier");
    await userEvent.click(createSubBtn);
    expect(handleCreateSubfolder).toHaveBeenCalledWith(inboxFolder);
  });

  it("permet de déclencher l'importation de messages (.eml)", async () => {
    const handleImportEml = vi.fn();

    render(
      <FolderActionsMenu
        folder={inboxFolder}
        accountId="acc-1"
        onCreateSubfolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImportEml={handleImportEml}
      />
    );

    const trigger = screen.getByRole("button", { name: /Actions pour le dossier INBOX/i });
    await userEvent.click(trigger);

    const importBtn = await screen.findByText("Importer des messages (.eml)");
    await userEvent.click(importBtn);
    expect(handleImportEml).toHaveBeenCalledWith(inboxFolder);
  });

  it("permet de renommer un dossier personnalisé", async () => {
    const handleRename = vi.fn();

    render(
      <FolderActionsMenu
        folder={customFolder}
        accountId="acc-1"
        onCreateSubfolder={vi.fn()}
        onRename={handleRename}
        onDelete={vi.fn()}
        onImportEml={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: /Actions pour le dossier Projets/i });
    await userEvent.click(trigger);

    const renameBtn = await screen.findByText("Renommer");
    expect(screen.queryByText("Dossier système protégé")).not.toBeInTheDocument();
    await userEvent.click(renameBtn);
    expect(handleRename).toHaveBeenCalledWith(customFolder);
  });

  it("permet de supprimer un dossier personnalisé", async () => {
    const handleDelete = vi.fn();

    render(
      <FolderActionsMenu
        folder={customFolder}
        accountId="acc-1"
        onCreateSubfolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={handleDelete}
        onImportEml={vi.fn()}
      />
    );

    const trigger = screen.getByRole("button", { name: /Actions pour le dossier Projets/i });
    await userEvent.click(trigger);

    const deleteBtn = await screen.findByText("Supprimer");
    await userEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith(customFolder);
  });

  it("propose de vider le dossier pour un dossier Corbeille", async () => {
    const handleEmpty = vi.fn();
    const trashFolder: FolderInfo = {
      path: "Trash",
      name: "Trash",
      delimiter: "/",
      specialUse: "\\Trash",
      flags: [],
    };

    render(
      <FolderActionsMenu
        folder={trashFolder}
        accountId="acc-1"
        onCreateSubfolder={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
        onImportEml={vi.fn()}
        onEmpty={handleEmpty}
      />
    );

    const trigger = screen.getByRole("button", { name: /Actions pour le dossier Trash/i });
    await userEvent.click(trigger);

    const emptyBtn = await screen.findByText("Vider le dossier");
    await userEvent.click(emptyBtn);
    expect(handleEmpty).toHaveBeenCalledWith(trashFolder);
  });
});


