import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { AttachmentPreviewModal } from "./AttachmentPreviewModal";
import * as api from "@/lib/api";
import * as messageQueries from "@/lib/queries/messages";
import type { AttachmentInfo } from "@/lib/api-types";

vi.mock("@/lib/api", () => ({
  apiFetchBlob: vi.fn(),
}));

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

describe("AttachmentPreviewModal", () => {
  const mockAttachments: AttachmentInfo[] = [
    {
      part: "1",
      filename: "image.png",
      contentType: "image/png",
      size: 1024 * 100,
      disposition: "attachment",
    },
    {
      part: "2",
      filename: "document.pdf",
      contentType: "application/pdf",
      size: 1024 * 500,
      disposition: "attachment",
    },
    {
      part: "3",
      filename: "archive.zip",
      contentType: "application/zip",
      size: 1024 * 1024 * 5,
      disposition: "attachment",
    },
  ];

  let createObjectURLSpy: MockInstance;
  let revokeObjectURLSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:http://localhost/fake-blob");
    revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  afterEach(() => {
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("affiche les métadonnées et le compteur de pièces jointes", async () => {
    const fakeBlob = new Blob(["test image content"], { type: "image/png" });
    vi.mocked(api.apiFetchBlob).mockResolvedValueOnce(fakeBlob);

    await act(async () => {
      render(
        <AttachmentPreviewModal
          accountId="acc1"
          folder="INBOX"
          uid={100}
          attachments={mockAttachments}
          currentIndex={0}
          onClose={vi.fn()}
          onNavigate={vi.fn()}
        />,
      );
    });

    expect(screen.getByText("image.png")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);
    });
  });

  it("navigue vers le fichier suivant lors du clic sur le chevron droit ou la touche ArrowRight", async () => {
    const onNavigate = vi.fn();
    const fakeBlob = new Blob(["fake pdf"], { type: "application/pdf" });
    vi.mocked(api.apiFetchBlob).mockResolvedValueOnce(fakeBlob);

    await act(async () => {
      render(
        <AttachmentPreviewModal
          accountId="acc1"
          folder="INBOX"
          uid={100}
          attachments={mockAttachments}
          currentIndex={1}
          onClose={vi.fn()}
          onNavigate={onNavigate}
        />,
      );
    });

    // Clic sur le bouton Suivant
    const nextButton = screen.getByTitle(/pièce jointe suivante/i);
    await act(async () => {
      fireEvent.click(nextButton);
    });
    expect(onNavigate).toHaveBeenCalledWith(2);

    // Touche ArrowLeft
    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
    });
    expect(onNavigate).toHaveBeenCalledWith(0);
  });

  it("ferme la modale lors de la pression sur Escape ou du clic sur la croix", async () => {
    const onClose = vi.fn();
    const fakeBlob = new Blob(["fake data"]);
    vi.mocked(api.apiFetchBlob).mockResolvedValueOnce(fakeBlob);

    await act(async () => {
      render(
        <AttachmentPreviewModal
          accountId="acc1"
          folder="INBOX"
          uid={100}
          attachments={mockAttachments}
          currentIndex={0}
          onClose={onClose}
          onNavigate={vi.fn()}
        />,
      );
    });

    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    const closeButton = screen.getByTitle(/fermer/i);
    await act(async () => {
      fireEvent.click(closeButton);
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("affiche la vue UnsupportedPreview pour un fichier non prévisualisable (zip)", async () => {
    render(
      <AttachmentPreviewModal
        accountId="acc1"
        folder="INBOX"
        uid={100}
        attachments={mockAttachments}
        currentIndex={2} // archive.zip
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getAllByText("archive.zip").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/aucun aperçu interactif n'est disponible/i)).toBeInTheDocument();
    expect(api.apiFetchBlob).not.toHaveBeenCalled();
  });

  it("révoque l'URL d'objet lors du démontage pour éviter les fuites mémoire", async () => {
    const fakeBlob = new Blob(["fake data"]);
    vi.mocked(api.apiFetchBlob).mockResolvedValueOnce(fakeBlob);

    const { unmount } = render(
      <AttachmentPreviewModal
        accountId="acc1"
        folder="INBOX"
        uid={100}
        attachments={mockAttachments}
        currentIndex={0}
        onClose={vi.fn()}
        onNavigate={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
    });

    unmount();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:http://localhost/fake-blob");
  });
});
