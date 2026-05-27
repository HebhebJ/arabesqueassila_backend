# Deployment Guide

> Vercel (Vite SPA) + Railway (Express + PostgreSQL)

---

## 1. Repository Structure

Single repo with two subdirectories:

```
arabesque/
├── arabesque-web/          # Vite React SPA
├── arabesque-api/          # Express API
├── docs/                   # Documentation
└── README.md
```

Both services deploy from the same repo but different subdirectories.

---

## 2. Railway Backend Deploy

### Project Setup
1. railway.app → New Project
2. Add PostgreSQL: New → Database → Add PostgreSQL (5GB volume attached)
3. New → GitHub Repo → Select repo
4. Configure service:
   - **Root Directory**: `arabesque-api/`
   - **Build**: `npm install && npx prisma generate && npm run build`
   - **Start**: `npm start`

### Environment Variables (Railway Dashboard)
```env
PORT=3001
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}    # Auto-injected by Railway
ADMIN_PASSWORD_HASH=$2b$10$...
JWT_SECRET=your-very-long-random-secret-min-32-chars
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
FRONTEND_URL=https://arabesque-assila.vercel.app
```

### Database Migrations
```bash
# After first deploy, run migrations
railway login
railway link
railway run -- npx prisma migrate deploy
```

### Generate Domain
Settings → Generate Domain → `arabesque-api.up.railway.app`

---

## 3. Vercel Frontend Deploy

### Project Setup
1. vercel.com → Add New Project
2. Import Git repo
3. Configure:
   - **Framework Preset**: Vite
   - **Root Directory**: `arabesque-web/`
   - **Build Command**: `npm run build` (default for Vite)
   - **Output Directory**: `dist`

### Environment Variables
```env
VITE_API_URL=https://arabesque-api.up.railway.app/api/v1
VITE_CLOUDINARY_CLOUD_NAME=xxx
```

### Deploy
- Push to `main` → auto-deploy
- Preview deployments for PRs

---

## 4. CORS Configuration

After both are deployed, update Railway env:

```env
FRONTEND_URL=https://arabesque-assila.vercel.app
```

Redeploy backend to pick up the new CORS origin.

---

## 5. Local Development

### Terminal 1 — Backend
```bash
cd arabesque-api
cp .env.example .env
# Edit .env with local values
npm install
npx prisma migrate dev
npm run dev          # nodemon/ts-node-dev on :3001
```

### Terminal 2 — Frontend
```bash
cd arabesque-web
cp .env.example .env.local
# VITE_API_URL=http://localhost:3001/api/v1
npm install
npm run dev          # Vite on :5173
```

---

## 6. Cost Projection

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Vercel | Free (Vite static) | $0 |
| Railway | Hobby ($5 credit/mo) | ~$3-5 |
| PostgreSQL | Railway included | $0 |
| Cloudinary | Free (25GB) | $0 |
| Domain | `.com` or `.tn` | ~$10-15/year |
| **Total** | | **~$5/mo** |

---

## 7. Backup

Railway PostgreSQL has daily automated backups. For extra safety:

```bash
# Manual dump via Railway CLI
railway run -- pg_dump $DATABASE_URL > backup_$(date +%F).sql
```
