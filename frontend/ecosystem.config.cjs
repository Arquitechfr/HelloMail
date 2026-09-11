// pm2 — Configuration du frontend Next.js HelloMail.
//
// Usage : pm2 start ecosystem.config.cjs
//
// .cjs obligatoire : pm2 charge ce fichier en CommonJS.
// BACKEND_URL est lu au runtime par les route handlers (/api/auth/refresh,
// /api/logos/:domain) — adapter si l'API n'est pas sur la même machine.
// NB : les rewrites /api/* vers le backend sont fixés au moment du build
// (BACKEND_URL doit donc aussi être défini avant `pnpm deploy:frontend`).
module.exports = {
  apps: [
    {
      name: 'hellomail-web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:4001',
      },
    },
  ],
};
