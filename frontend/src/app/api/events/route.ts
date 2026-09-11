import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4001";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Route Handler dédiée au stream SSE `/api/events`.
 *
 * Le rewrite générique `/api/:path*` proxifie les réponses en relayant les
 * headers upstream, dont des headers hop-by-hop (`Connection`, `Transfer-Encoding`)
 * interdits en HTTP/2 — cause d'ERR_HTTP2_PROTOCOL_ERROR côté navigateur.
 * Ce handler streame le body backend avec une whitelist de headers propres.
 *
 * Auth : le JWT est forwardé via le query param `?token=` (EventSource ne
 * supporte pas les headers custom).
 */
export async function GET(req: NextRequest): Promise<Response> {
  const token = req.nextUrl.searchParams.get("token") ?? "";

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/events?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      headers: { accept: "text/event-stream" },
    });
  } catch {
    return NextResponse.json(
      { error: { message: "Erreur connexion backend" } },
      { status: 502 },
    );
  }

  if (!backendRes.ok || !backendRes.body) {
    return NextResponse.json(
      { error: { message: "Erreur connexion temps réel" } },
      { status: backendRes.status || 502 },
    );
  }

  return new Response(backendRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
