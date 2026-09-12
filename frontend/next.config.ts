import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4001";

const isDev = process.env.NODE_ENV === "development";

// CSP stricte en production, permissive en dev (Next.js HMR/Turbopack nécessite
// inline scripts + eval). On garde les autres headers de sécurité partout.
// 'unsafe-inline' est requis aussi en prod : Next.js injecte des scripts inline
// obligatoires (payload RSC self.__next_f, init next-themes) — sans nonce ni
// hash dynamique, les bloquer casse l'hydratation. 'unsafe-eval' reste bloqué.
const csp = isDev
  ? [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http: https:",
      "font-src 'self' data:",
      "frame-src 'self' srcdoc",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http: https:",
      "font-src 'self' data:",
      "frame-src 'self' srcdoc",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  rewrites: () => [
    {
      source: "/api/:path*",
      destination: `${BACKEND_URL}/api/:path*`,
    },
  ],
  headers: () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: csp,
        },
      ],
    },
  ],
};

export default nextConfig;
