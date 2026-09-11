import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4001";

/**
 * Route Handler Next.js server-side pour /api/logos/:domain.
 * Relaie la requête vers le backend Express (port 4001) sans mise en cache serveur
 * pour garantir que les logos sont toujours à jour et non bloqués par le proxy Next.js.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
): Promise<NextResponse> {
  const { domain } = await params;
  if (!domain) {
    return new NextResponse(JSON.stringify({ message: "Domaine requis" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/logos/${encodeURIComponent(domain)}`, {
      cache: "no-store",
    });

    if (!backendRes.ok) {
      return new NextResponse(await backendRes.text(), {
        status: backendRes.status,
        headers: {
          "Content-Type": backendRes.headers.get("content-type") || "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    const contentType = backendRes.headers.get("content-type") || "image/png";
    const buffer = await backendRes.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Cross-Origin-Resource-Policy": "cross-origin",
      },
    });
  } catch {
    return new NextResponse(JSON.stringify({ message: "Erreur connexion backend" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
