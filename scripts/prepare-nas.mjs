/**
 * Prépare frontend/ et backend/ — seuls dossiers à copier sur le NAS.
 * Usage: npm run prepare:nas
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const frontSrc = join(root, 'dist');
const backSrc = join(root, 'server', 'dist');
const frontOut = join(root, 'frontend');
const backOut = join(root, 'backend');

function emptyDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function copyDirContents(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`Manquant: ${src} — lance d’abord le build.`);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

console.log('→ build front + API…');
execSync('npm run build:all', { cwd: root, stdio: 'inherit' });

console.log('→ frontend/ ← dist/ + nginx embarqué');
emptyDir(frontOut);
copyDirContents(frontSrc, frontOut);
mkdirSync(join(frontOut, '_deploy', 'nginx'), { recursive: true });
cpSync(
  join(root, 'scripts', 'nas', 'nginx', 'default.conf'),
  join(frontOut, '_deploy', 'nginx', 'default.conf')
);
cpSync(
  join(root, 'scripts', 'nas', 'entrypoint.sh'),
  join(frontOut, '_deploy', 'entrypoint.sh')
);

if (!existsSync(join(frontOut, 'index.html'))) {
  throw new Error('frontend/index.html absent après copie');
}

console.log('→ backend/ ← server/dist + runtime…');
emptyDir(backOut);
copyDirContents(backSrc, join(backOut, 'dist'));
cpSync(join(root, 'server', 'package.json'), join(backOut, 'package.json'));
cpSync(join(root, 'server', 'package-lock.json'), join(backOut, 'package-lock.json'));
cpSync(join(root, 'server', 'prisma'), join(backOut, 'prisma'), { recursive: true });
cpSync(
  join(root, 'server', 'docker-entrypoint.sh'),
  join(backOut, 'docker-entrypoint.sh')
);

writeFileSync(
  join(frontOut, '.nas-ready'),
  `preparedAt=${new Date().toISOString()}\n`,
  'utf8'
);
writeFileSync(
  join(backOut, '.nas-ready'),
  `preparedAt=${new Date().toISOString()}\n`,
  'utf8'
);

console.log(`
OK — sur le NAS tu n’as besoin QUE de :

  /Volume1/Docker/cobea/frontend/   ← copie le dossier frontend/
  /Volume1/Docker/cobea/backend/    ← copie le dossier backend/

(Le YAML se colle dans Docker Manager, pas besoin sur le disque.)

Puis Restart des conteneurs.
`);
