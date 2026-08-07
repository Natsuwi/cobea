/**
 * Sync Prisma schema → Postgres before the API starts.
 * Set COBEA_PRISMA_ACCEPT_DATA_LOSS=0 to refuse destructive pushes (prod).
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const acceptDataLoss = process.env.COBEA_PRISMA_ACCEPT_DATA_LOSS !== '0';
const pushCmd = acceptDataLoss
  ? 'npx prisma db push --accept-data-loss'
  : 'npx prisma db push';

console.log('[cobea-db] prisma generate…');
execSync('npx prisma generate', { cwd: root, stdio: 'inherit' });

console.log(`[cobea-db] ${pushCmd}…`);
execSync(pushCmd, { cwd: root, stdio: 'inherit' });

console.log('[cobea-db] schema in sync');
