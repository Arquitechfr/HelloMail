import { describe, it, expect } from "vitest";
import { isTokenExpiredOrExpiring } from "./useSSE";

function makeJwt(expSecondsFromNow: number): string {
  const payload = { sub: "u1", exp: Math.floor(Date.now() / 1000) + expSecondsFromNow };
  return `h.${btoa(JSON.stringify(payload))}.s`;
}

describe("isTokenExpiredOrExpiring", () => {
  it("détecte un token expiré", () => {
    expect(isTokenExpiredOrExpiring(makeJwt(-60))).toBe(true);
  });

  it("détecte un token expirant dans < 30s", () => {
    expect(isTokenExpiredOrExpiring(makeJwt(10))).toBe(true);
  });

  it("accepte un token encore valide", () => {
    expect(isTokenExpiredOrExpiring(makeJwt(600))).toBe(false);
  });

  it("rejette un token malformé", () => {
    expect(isTokenExpiredOrExpiring("not-a-jwt")).toBe(true);
  });
});
