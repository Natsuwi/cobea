#!/bin/sh
set -e
cd /app

if [ ! -f package.json ]; then
  echo "[cobea-api] ERREUR: package.json introuvable dans /app (backend/)."
  exit 1
fi

if [ ! -f dist/index.js ]; then
  echo "[cobea-api] ERREUR: dist/index.js introuvable."
  echo "Sur le PC: npm run prepare:nas puis copie backend/ vers le NAS."
  exit 1
fi

if [ ! -d node_modules/express ]; then
  echo "[cobea-api] Installing npm dependencies…"
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npx prisma generate
fi

echo "[cobea-api] prisma db push…"
if [ "${COBEA_PRISMA_ACCEPT_DATA_LOSS:-1}" != "0" ]; then
  npx prisma db push --accept-data-loss
else
  npx prisma db push
fi

echo "[cobea-api] starting…"
exec node dist/index.js
