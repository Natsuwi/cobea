# Cobea

Galerie zen (React + Vite) avec backend Express dual-mode sur NAS Postgres.

## Modes de stockage

Par utilisateur (paramètres compte, avatar en haut à droite) :

| Mode | Contenu |
|------|---------|
| Standard (défaut) | Tout en Postgres (`BYTEA`) |
| Google Drive | Métadonnées + vignettes en Postgres ; binaires sur Drive |

Pour activer Google : toggle dans le compte → Client ID / Secret (ou vars serveur) → Connecter Google Drive.

Redirect OAuth à enregistrer dans Google Cloud :  
`https://cobea.tnas-movies.ddns.net/api/auth/google/callback` (+ Drive API).

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

- Host Docker NAS : `shared-postgres:5432` / DB `cobea_db` (réseau `postgres-net`)
- Dev local Windows : `IP_DU_NAS:5432` (port exposé du Postgres partagé)
- API : port **3847**
- Google OAuth (optionnel côté serveur, sinon saisi dans les paramètres) : redirect  
  `https://cobea.tnas-movies.ddns.net/api/auth/google/callback`  
  + Drive API activée

### Docker sur le NAS (TerraMaster)

Sur le disque, **seulement** :

```
/Volume1/Docker/cobea/
├── frontend/
└── backend/
```

Le YAML se colle dans Docker Manager (pas besoin du fichier sur le NAS).

#### Déployer

```bash
npm run prepare:nas
```

Copie `frontend/` et `backend/` → `/Volume1/Docker/cobea/`, puis **Restart**.

Accès : `https://cobea.tnas-movies.ddns.net` (proxy → `:8083`).  
OAuth redirect : `https://cobea.tnas-movies.ddns.net/api/auth/google/callback`.

## Auth

- `POST /api/auth/register` — crée `user` + `profile` (1:1)
- `POST /api/auth/login` — JWT Bearer
- Compte Google Drive : panneau profil → Connecter (mode `google` uniquement)

## Sécurité

Ne committe jamais `server/.env` (déjà ignoré via `.env*`).
