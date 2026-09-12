import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ImageViewer } from "./ImageViewer";
import { TextViewer } from "./TextViewer";
import { MediaViewer } from "./MediaViewer";
import { UnsupportedPreview } from "./UnsupportedPreview";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Preview Viewers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ImageViewer", () => {
    it("affiche l'image et permet le zoom et la rotation", () => {
      render(<ImageViewer url="blob:http://localhost/test.png" filename="test.png" />);

      const img = screen.getByAltText("test.png");
      expect(img).toBeInTheDocument();
      expect(screen.getByText("100%")).toBeInTheDocument();

      // Zoom avant
      const zoomInBtn = screen.getByTitle(/zoom avant/i);
      fireEvent.click(zoomInBtn);
      expect(screen.getByText("125%")).toBeInTheDocument();

      // Rotation
      const rotateBtn = screen.getByTitle(/pivoter/i);
      fireEvent.click(rotateBtn);
      expect(img.style.transform).toContain("rotate(90deg)");

      // Réinitialiser
      const resetBtn = screen.getByTitle(/réinitialiser/i);
      fireEvent.click(resetBtn);
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(img.style.transform).toContain("rotate(0deg)");
    });
  });

  describe("TextViewer", () => {
    it("lit et affiche le contenu texte et permet la copie", async () => {
      const blob = new Blob(["ligne 1\nligne 2\nligne 3"], { type: "text/plain" });

      const writeTextSpy = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, {
        clipboard: {
          writeText: writeTextSpy,
        },
      });

      await act(async () => {
        render(<TextViewer blob={blob} filename="notes.txt" />);
      });

      await waitFor(() => {
        expect(screen.getByText("ligne 1")).toBeInTheDocument();
        expect(screen.getByText("ligne 2")).toBeInTheDocument();
        expect(screen.getByText("3 lignes")).toBeInTheDocument();
      });

      const copyBtn = screen.getByRole("button", { name: /copier/i });
      await act(async () => {
        fireEvent.click(copyBtn);
      });

      expect(writeTextSpy).toHaveBeenCalledWith("ligne 1\nligne 2\nligne 3");
    });
  });

  describe("MediaViewer", () => {
    it("rend un lecteur audio pour l'audio", () => {
      const { container } = render(
        <MediaViewer url="blob:http://localhost/audio.mp3" filename="musique.mp3" category="audio" />,
      );
      expect(container.querySelector("audio")).toBeInTheDocument();
      expect(screen.getByText("musique.mp3")).toBeInTheDocument();
    });

    it("rend un lecteur vidéo pour la vidéo", () => {
      const { container } = render(
        <MediaViewer url="blob:http://localhost/video.mp4" filename="clip.mp4" category="video" />,
      );
      expect(container.querySelector("video")).toBeInTheDocument();
      expect(screen.getByText("clip.mp4")).toBeInTheDocument();
    });
  });

  describe("UnsupportedPreview", () => {
    it("affiche le message et le bouton de téléchargement", () => {
      const onDownload = vi.fn();
      render(
        <UnsupportedPreview
          filename="archive.tar.gz"
          contentType="application/gzip"
          size={1024 * 1024}
          onDownload={onDownload}
        />,
      );

      expect(screen.getByText("archive.tar.gz")).toBeInTheDocument();
      const downloadBtn = screen.getByRole("button", { name: /télécharger le fichier/i });
      fireEvent.click(downloadBtn);
      expect(onDownload).toHaveBeenCalledTimes(1);
    });
  });
});
