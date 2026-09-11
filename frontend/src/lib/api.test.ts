import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "./api";
import { useAuthStore } from "./stores/authStore";

/**
 * Régression prod : le backend renvoie les erreurs sous la forme
 * `{ error: { message, details } }` mais parseResponse lisait `body.message`
 * à la racine → tous les messages d'erreur API s'affichaient « Erreur inconnue »
 * (ex. le 422 SMTP sur /send masquait la vraie cause).
 */
describe("apiFetch — parsing des erreurs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it("extrait le message depuis body.error.message (shape backend)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { message: "Envoi SMTP échoué : AUTH failed" } }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const err = await apiFetch("/api/accounts/x/send", { method: "POST" }).catch(
      (e: unknown) => e,
    );

    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(422);
    expect(apiErr.message).toBe("Envoi SMTP échoué : AUTH failed");
  });

  it("mappe error.details vers fieldErrors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              message: "Erreur de validation des données",
              details: { to: ["Au moins un destinataire requis"] },
            },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const err = await apiFetch("/api/x", { method: "POST" }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.message).toBe("Erreur de validation des données");
    expect(apiErr.fieldErrors).toEqual({ to: ["Au moins un destinataire requis"] });
  });

  it("fallback sur body.message si la shape est plate", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Introuvable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const err = (await apiFetch("/api/x").catch((e: unknown) => e)) as ApiError;

    expect(err.message).toBe("Introuvable");
  });
});
