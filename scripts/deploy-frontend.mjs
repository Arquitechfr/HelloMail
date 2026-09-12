// Génère deploy/frontend/ : uniquement les fichiers à uploader sur le serveur.
// Sur le serveur : pnpm install --prod --frozen-lockfile && pm2 start ecosystem.config.cjs
import path from 'node:path';
import { copy, copyEnvForProduction, DEPLOY_DIR, resetDir, ROOT, run } from './deploy-common.mjs';

const SRC = path.join(ROOT, 'frontend');
const DEST = path.join(DEPLOY_DIR, 'frontend');

console.log('=== Déploiement frontend Mailora ===');

if (!process.env.BACKEND_URL) {
  console.warn('⚠  BACKEND_URL non défini — les rewrites /api/* seront fixés sur http://localhost:4001 au build.');
  console.warn('   Pour une API distante : BACKEND_URL=https://api.mondomaine.fr pnpm deploy:frontend\n');
}

// Nettoyage complet avant régénération — aucun fichier obsolète ne subsiste
resetDir(DEST);
run('pnpm --filter frontend build');

// .next/ sans les artefacts inutiles au runtime : cache de build, artefacts
// Turbopack dev (.next/dev peut peser plusieurs Go), traces et diagnostics.
const NEXT_BUILD_ONLY = new Set(['cache', 'dev', 'trace', 'trace-build', 'diagnostics']);
copy(path.join(SRC, '.next'), path.join(DEST, '.next'), (src) => {
  const rel = path.relative(path.join(SRC, '.next'), src);
  return !NEXT_BUILD_ONLY.has(rel.split(path.sep)[0]);
});

for (const file of [
  'public',
  'package.json',
  'pnpm-lock.yaml',      // lockfile standalone propre au frontend
  'pnpm-workspace.yaml', // racine workspace autonome (allowBuilds)
  'next.config.ts',
  'ecosystem.config.cjs',
]) {
  copy(path.join(SRC, file), path.join(DEST, file));
}

// .env copié s'il existe (BACKEND_URL lu au runtime par les route handlers),
// NODE_ENV forcé à production
copyEnvForProduction(path.join(SRC, '.env'), DEST);

console.log(`
✔ deploy/frontend/ prêt — uploader le dossier via FTP, puis sur le serveur :
    cd frontend
    pnpm install --prod --frozen-lockfile
    pm2 start ecosystem.config.cjs   # mailora-web (Next.js, port 3001)
`);
