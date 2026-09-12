import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4001";

/**
 * Route Handler server-side pour le refresh token.
 *
 * Le cookie httpOnly `mailora_refresh` (path /api/auth, sameSite strict)
 * ne peut pas être envoyé directement par le navigateur sur un rewrite Next.js
 * côté client. Cette route handler :
 * 1. Reçoit la requête POST du navigateur (same-origin, cookie envoyé).
 * 2. Forward vers le backend en passant le cookie via header Cookie.
 * 3. Renvoie le nouvel access token au client et propage le Set-Cookie.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const cookieHeader = req.headers.get("cookie") ?? "";

  const backendRes = await fetch(`${BACKEND_URL}/api/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: cookieHeader,
    },
  });

  const setCookie = backendRes.headers.get("set-cookie");
  const body = await backendRes.json();

  const response = NextResponse.json(body, { status: backendRes.status });

  // Propage le Set-Cookie du backend (nouveau refresh token rotaté).
  if (setCookie) {
    response.headers.set("set-cookie", setCookie);
  }

  return response;
}
