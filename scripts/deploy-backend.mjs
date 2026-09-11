// Génère deploy/backend/ : uniquement les fichiers à uploader sur le serveur.
// Sur le serveur : pnpm install --prod --frozen-lockfile && pm2 start ecosystem.config.cjs
import path from 'node:path';
import { copy, copyEnvForProduction, DEPLOY_DIR, resetDir, ROOT, run, writeStandaloneLockfile } from './deploy-common.mjs';

const SRC = path.join(ROOT, 'backend');
const DEST = path.join(DEPLOY_DIR, 'backend');

console.log('=== Déploiement backend HelloMail ===');

// Nettoyage complet avant régénération — aucun fichier obsolète ne subsiste
resetDir(DEST);
run('pnpm --filter backend build');

// dist/ compilé, sans les fichiers de test compilés (*.test.js, dist/test/)
copy(path.join(SRC, 'dist'), path.join(DEST, 'dist'), (src) => {
  const rel = path.relative(path.join(SRC, 'dist'), src);
  return rel !== 'test' && !rel.startsWith(`test${path.sep}`) && !/\.test\.(js|js\.map)$/.test(rel);
});

// public/logos : utilisé au runtime par logoService (logos locaux personnalisés)
copy(path.join(SRC, 'public'), path.join(DEST, 'public'));

for (const file of ['package.json', 'ecosystem.config.cjs']) {
  copy(path.join(SRC, file), path.join(DEST, file));
}

// Lockfile standalone extrait du lockfile racine (versions identiques au dev)
writeStandaloneLockfile('backend', DEST);

// Marque deploy/backend comme racine workspace autonome sur le serveur
copy(path.join(ROOT, 'pnpm-workspace.yaml'), path.join(DEST, 'pnpm-workspace.yaml'));

// .env copié tel quel, NODE_ENV forcé à production
copyEnvForProduction(path.join(SRC, '.env'), DEST);

console.log(`
✔ deploy/backend/ prêt — uploader le dossier via FTP, puis sur le serveur :
    cd backend
    pnpm install --prod --frozen-lockfile
    pm2 start ecosystem.config.cjs   # hellomail-api + hellomail-worker
`);
