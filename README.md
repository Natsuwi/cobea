# Cobea / Haven

Galerie zen (React + Vite) avec backend Express dual-mode sur NAS Postgres.

## Modes de stockage

| `STORAGE_MODE` | Contenu |
|----------------|---------|
| `standard` | Tout en Postgres (`BYTEA` pour les fichiers) |
| `google` | Métadonnées + vignettes cache en Postgres ; binaires sur Google Drive |

La galerie ne fait **jamais** de `files.list` Drive — uniquement upload et ouverture plein fichier.

## Démarrage local (front)

```bash
npm install
npm run dev
```

Le proxy Vite envoie `/api` → `http://localhost:3847`.

## Backend

```bash
cd server
npm install
cp .env.example .env   # renseigner secrets
npx prisma db push     # nécessite accès à Postgres
npm run dev
```

### Variables (`server/.env`)

Voir [`server/.env.example`](server/.env.example).

- Host Docker NAS : `waatch-postgres:5432` / DB `cobea_db`
- API : port **3847**
- Google OAuth : ajouter la redirect  
  `http://localhost:3847/api/auth/google/callback`  
  dans la console Google Cloud (Drive API activée)

### Docker sur le NAS

1. Placer le repo sur le NAS / build depuis ta machine vers le registry local
2. Vérifier le **nom du réseau Docker** où tourne `waatch-postgres` :

```bash
docker network ls
docker inspect waatch-postgres --format '{{json .NetworkSettings.Networks}}'
```

3. Ajuster `networks.waatch-net.name` dans [`docker-compose.yml`](docker-compose.yml) si besoin
4. Lancer :

```bash
docker compose up -d --build
```

Au démarrage du conteneur : `prisma db push` puis l’API.

## Auth

- `POST /api/auth/register` — crée `user` + `profile` (1:1)
- `POST /api/auth/login` — JWT Bearer
- Compte Google Drive : panneau profil → Connecter (mode `google` uniquement)

## Sécurité

Ne committe jamais `server/.env` (déjà ignoré via `.env*`).
