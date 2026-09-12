import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { PwaRegister } from "./PwaRegister";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    info: vi.fn(),
  },
}));

describe("PwaRegister", () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it("ne fait rien si serviceWorker n'est pas supporté", () => {
    Object.defineProperty(global, "navigator", {
      value: {},
      configurable: true,
      writable: true,
    });

    const { container } = render(<PwaRegister />);
    expect(container.firstChild).toBeNull();
  });

  it("enregistre le Service Worker /sw.js lorsque le document est déjà prêt", async () => {
    const registerMock = vi.fn().mockResolvedValue({
      addEventListener: vi.fn(),
    });

    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          register: registerMock,
          controller: null,
        },
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });

    render(<PwaRegister />);

    expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("notifie l'utilisateur via toast lorsqu'un nouveau worker est installé", async () => {
    type Listener = () => void;
    const registrationListeners: Record<string, Listener> = {};
    const workerListeners: Record<string, Listener> = {};

    const mockInstallingWorker = {
      state: "installed",
      addEventListener: vi.fn((event: string, cb: Listener) => {
        workerListeners[event] = cb;
      }),
    };

    const registerMock = vi.fn().mockResolvedValue({
      installing: mockInstallingWorker,
      addEventListener: vi.fn((event: string, cb: Listener) => {
        registrationListeners[event] = cb;
      }),
    });

    Object.defineProperty(global, "navigator", {
      value: {
        serviceWorker: {
          register: registerMock,
          controller: {}, // Ancien worker actif présent
        },
      },
      configurable: true,
      writable: true,
    });

    Object.defineProperty(document, "readyState", {
      value: "complete",
      configurable: true,
    });

    render(<PwaRegister />);

    // Attendre que la promesse register soit résolue
    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalled();
      expect(registrationListeners["updatefound"]).toBeDefined();
    });

    // Déclencher l'événement updatefound
    registrationListeners["updatefound"]();
    expect(mockInstallingWorker.addEventListener).toHaveBeenCalledWith(
      "statechange",
      expect.any(Function),
    );

    // Déclencher le changement d'état vers installed
    workerListeners["statechange"]();
    expect(toast.info).toHaveBeenCalledWith(
      "Une nouvelle version de HelloMail est prête",
      expect.objectContaining({
        duration: 8000,
      }),
    );
  });
});
