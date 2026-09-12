import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AttachmentList } from "./AttachmentList";
import * as messageQueries from "@/lib/queries/messages";
import type { AttachmentInfo } from "@/lib/api-types";

vi.mock("@/lib/queries/messages", () => ({
  downloadAttachment: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock léger de AttachmentPreviewModal pour tester son ouverture
vi.mock("./preview/AttachmentPreviewModal", () => ({
  AttachmentPreviewModal: ({
    currentIndex,
    onClose,
  }: {
    currentIndex: number;
    onClose: () => void;
  }) => (
    <div data-testid="preview-modal">
      <span>Modal Index: {currentIndex}</span>
      <button onClick={onClose}>Fermer Modal</button>
    </div>
  ),
}));

describe("AttachmentList", () => {
  const mockAttachments: AttachmentInfo[] = [
    {
      part: "2",
      filename: "photo.jpg",
      contentType: "image/jpeg",
      size: 1024 * 500, // 500 Ko
      disposition: "attachment",
    },
    {
      part: "3",
      filename: "rapport.pdf",
      contentType: "application/pdf",
      size: 1024 * 1024 * 2, // 2 Mo
      disposition: "attachment",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ne rend rien si aucune pièce jointe", () => {
    const { container } = render(
      <AttachmentList accountId="acc1" folder="INBOX" uid={10} attachments={[]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche la liste des pièces jointes avec leurs noms", () => {
    render(
      <AttachmentList accountId="acc1" folder="INBOX" uid={10} attachments={mockAttachments} />,
    );

    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText("rapport.pdf")).toBeInTheDocument();
    expect(screen.getByText("Pièces jointes (2)")).toBeInTheDocument();
  });

  it("télécharge une pièce jointe individuelle au clic sur son bouton", async () => {
    render(
      <AttachmentList accountId="acc1" folder="INBOX" uid={10} attachments={mockAttachments} />,
    );

    const downloadButtons = screen.getAllByRole("button", { name: /télécharger/i });
    fireEvent.click(downloadButtons[0]);

    await waitFor(() => {
      expect(messageQueries.downloadAttachment).toHaveBeenCalledWith(
        "acc1",
        "INBOX",
        10,
        "2",
        "photo.jpg",
      );
    });
  });

  it("télécharge toutes les pièces jointes lors du clic sur 'Tout télécharger'", async () => {
    render(
      <AttachmentList accountId="acc1" folder="INBOX" uid={10} attachments={mockAttachments} />,
    );

    const downloadAllButton = screen.getByRole("button", { name: /tout télécharger/i });
    fireEvent.click(downloadAllButton);

    await waitFor(() => {
      expect(messageQueries.downloadAttachment).toHaveBeenCalledTimes(2);
      expect(messageQueries.downloadAttachment).toHaveBeenNthCalledWith(
        1,
        "acc1",
        "INBOX",
        10,
        "2",
        "photo.jpg",
      );
      expect(messageQueries.downloadAttachment).toHaveBeenNthCalledWith(
        2,
        "acc1",
        "INBOX",
        10,
        "3",
        "rapport.pdf",
      );
    });
  });

  it("ouvre la modale d'aperçu au clic sur le bouton d'aperçu ou le nom du fichier", () => {
    render(
      <AttachmentList accountId="acc1" folder="INBOX" uid={10} attachments={mockAttachments} />,
    );

    const previewButtons = screen.getAllByRole("button", { name: /aperçu de/i });
    fireEvent.click(previewButtons[0]);

    expect(screen.getByTestId("preview-modal")).toBeInTheDocument();
    expect(screen.getByText("Modal Index: 0")).toBeInTheDocument();

    // Fermeture de la modale
    fireEvent.click(screen.getByText("Fermer Modal"));
    expect(screen.queryByTestId("preview-modal")).not.toBeInTheDocument();
  });
});
