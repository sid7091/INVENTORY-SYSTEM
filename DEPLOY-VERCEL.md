# Deploying to Vercel (with auto-deploy on push)

The app runs zero-config locally on **SQLite + local file uploads**. Vercel is
serverless — its filesystem is read-only and wiped between requests — so a
hosted deploy needs two swaps:

1. **Database** → hosted **Postgres** (recommended: [Neon](https://neon.tech), free tier)
2. **Photo storage** → **Vercel Blob** (already wired up; just add the token)

Once the GitHub repo is connected to a Vercel project, **every push to the
branch auto-deploys** — no manual step.

---

## 1. Create a Postgres database (Neon)

1. Sign up at <https://neon.tech> (free) and create a project.
2. Copy the **connection string** — it looks like
   `postgresql://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.

> Vercel Postgres or Supabase work too — just grab their connection string.

## 2. Switch Prisma to Postgres (one line)

In `prisma/schema.prisma`, change the datasource provider:

```prisma
datasource db {
  provider = "postgresql"   // was: "sqlite"
  url      = env("DATABASE_URL")
}
```

Then, pointing `DATABASE_URL` at your Neon string, create the schema and seed:

```bash
export DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
npx prisma db push
npm run db:seed
```

> Tip: use the same Neon string for local dev too, so local and production
> share one database engine. (Keep SQLite only if you don't deploy.)

## 3. Enable Vercel Blob (photo storage)

1. In the Vercel dashboard → your project → **Storage** → **Create → Blob**.
2. Vercel adds a `BLOB_READ_WRITE_TOKEN` env var automatically.

The app auto-detects that token: when it's present, photos (and the Photo Room
staging area) go to Blob; otherwise they use the local filesystem. No code
change needed — see `src/lib/storage.ts`.

## 4. Set environment variables in Vercel

Project → **Settings → Environment Variables** (Production + Preview):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | your Neon Postgres connection string |
| `AUTH_SECRET` | a long random string (e.g. `openssl rand -hex 32`) |
| `BLOB_READ_WRITE_TOKEN` | added automatically when you create Blob storage |
| `SEED_ADMIN_EMAIL` | e.g. `admin@eaglestone.com` |
| `SEED_ADMIN_PASSWORD` | a strong password |
| `NEXT_PUBLIC_BRAND_NAME` | `Eagle Stone` (white-label: change per client) |
| `NEXT_PUBLIC_BRAND_SHORT` | `Eagle` |

## 5. Connect the repo (enables auto-deploy)

1. Vercel dashboard → **Add New → Project** → import `sid7091/INVENTORY-SYSTEM`.
2. Pick the branch to deploy (e.g. `main` once the PR is merged, or the feature
   branch to preview it now).
3. Framework preset **Next.js** is auto-detected. Deploy.

From here, **every `git push` to that branch triggers a new deployment**
automatically. Pull requests get their own preview URLs.

## 6. First-run seed (create the admin user)

The build runs `prisma generate` but not the seed. After the first deploy, seed
once against the production database from your machine:

```bash
export DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require"
npm run db:seed
```

(or run `npx prisma db push` + `npm run db:seed` from step 2 before deploying).

---

## Notes

- **Backups**: the SQLite file-copy backup (`npm run backup`) is for the
  self-hosted/SQLite setup. On Neon, use Neon's branching/point-in-time restore,
  or `pg_dump` on a schedule. The in-app `GET /api/backup` route is SQLite-only.
- **Search case-sensitivity**: Postgres `contains` filters are case-sensitive;
  block numbers are normalised to uppercase so block search is unaffected. If you
  want case-insensitive colour/exporter search on Postgres, add
  `mode: "insensitive"` to those filters in `src/lib/blocks.ts` (Postgres only).
- **White-label**: set `NEXT_PUBLIC_BRAND_*` per project — no code change.
