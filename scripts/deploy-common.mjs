// Helpers partagés des scripts de déploiement HelloMail.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DEPLOY_DIR = path.join(ROOT, 'deploy');

export function run(cmd, options = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit', ...options });
}

export function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

/** Copie récursive avec filtre optionnel (recevant le chemin source absolu). */
export function copy(src, dest, filter) {
  cpSync(src, dest, { recursive: true, filter });
}

/**
 * Extrait l'importeur `importer` du pnpm-lock.yaml racine du monorepo et génère
 * un lockfile standalone (importeur `.`) utilisable par `pnpm install --prod
 * --frozen-lockfile` sur le serveur. Garantit les mêmes versions résolues qu'en
 * développement.
 */
export function writeStandaloneLockfile(importer, destDir) {
  const lines = readFileSync(path.join(ROOT, 'pnpm-lock.yaml'), 'utf8').split('\n');

  const importersIdx = lines.findIndex((l) => l === 'importers:');
  if (importersIdx === -1) throw new Error('Section "importers:" introuvable dans pnpm-lock.yaml');

  // Fin de la section importers : première clé non indentée (packages:, snapshots:...)
  const sectionEnd = lines.findIndex((l, i) => i > importersIdx && /^\S/.test(l));
  if (sectionEnd === -1) throw new Error('Fin de section "importers:" introuvable');

  // Bloc de l'importeur demandé : "  backend:" jusqu'à la prochaine clé à 2 espaces
  const start = lines.findIndex((l, i) => i > importersIdx && i < sectionEnd && l === `  ${importer}:`);
  if (start === -1) throw new Error(`Importeur "${importer}" introuvable dans pnpm-lock.yaml`);

  let end = sectionEnd;
  for (let i = start + 1; i < sectionEnd; i++) {
    if (/^  \S/.test(lines[i])) {
      end = i;
      break;
    }
  }

  const body = lines.slice(start + 1, end);
  const output = [
    ...lines.slice(0, importersIdx + 1),
    '',
    '  .:',
    ...body,
    ...lines.slice(sectionEnd),
  ];

  writeFileSync(path.join(destDir, 'pnpm-lock.yaml'), output.join('\n'));
}

/**
 * Copie un fichier .env en forçant NODE_ENV=production
 * (remplace la ligne existante ou l'ajoute en fin de fichier).
 */
export function copyEnvForProduction(srcEnv, destDir) {
  if (!existsSync(srcEnv)) {
    console.warn(`⚠  ${srcEnv} introuvable — aucun .env copié (à créer sur le serveur).`);
    return;
  }
  const content = readFileSync(srcEnv, 'utf8');
  const updated = /^NODE_ENV=.*/m.test(content)
    ? content.replace(/^NODE_ENV=.*/m, 'NODE_ENV=production')
    : `${content.trimEnd()}\nNODE_ENV=production\n`;
  writeFileSync(path.join(destDir, '.env'), updated);
  console.log('  .env copié avec NODE_ENV=production');
}
