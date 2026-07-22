# Eagle Stone Inventory — Phase 1

Block-level marble & stone inventory for **Eagle Stone**. A login-gated staff
app built on **Next.js 15 (App Router) + TypeScript + Prisma**. Phase 1 is
inventory only — no customer-facing features.

The data model matches Eagle Stone's `Ready_to_dispatch.xlsx` exactly (block-level
tracking with optional per-slab child records for premium blocks).

## Features

| # | Feature | Where |
|---|---------|-------|
| 1 | **Block CRUD** — grid + list views, filters (colour / exporter / quarry / thickness / status / category) | `/inventory` |
| 2 | **Status changes** with a **mandatory reason** (`in-stock → reserved → sold → damaged → returned`) | block detail |
| 3 | **Bulk Excel import** — pre-mapped to the exact column layout, validation preview + dry-run + **transactional all-or-nothing commit** | `/import` |
| 4 | **Photo gate** — every block starts `NEEDS_PHOTOS`, hidden from the main list, sits in a queue; adding ≥1 photo auto-promotes it | `/needs-photos` |
| 5 | **Bulk Photo Room** — drop hundreds of files, auto-match filename → block number, review-and-approve grid (approve / skip / reassign / reject), unmatched tray; nothing commits until approved | `/photo-room` |
| 6 | **Audit log** — who / when / what / why on every change; per-block history timeline | `/audit`, block detail |
| 7 | **Reports** — low stock, aged blocks, value by warehouse / colour / exporter, photo backlog | `/reports` |
| 8 | **Bulletproof** — optimistic concurrency (stale-edit warning), soft delete + 30-day trash, daily backups, Excel export | throughout |

## Data model

`Block` fields mirror the spreadsheet: `blockNo` (e.g. `ANW-M543`), `quarryNo`,
`colour`/variety, `exporter`, `quarry`, `weightTons`, `lengthCm`, `heightCm`,
`pcs`, `endPcs`, `totalSft`, `thicknessMm` (normalised from `"18 MM"`),
`category` (the last spreadsheet column: Helios Listed / Photos Pending /
Partially Sold / To Be Ready / …) and `status`. Optional `Slab[]` children,
`Photo[]`, and `AuditLog[]`.

## Getting started

```bash
npm install
cp .env.example .env          # set DATABASE_URL to your Postgres (Neon) connection string + AUTH_SECRET
npm run db:push               # create the database tables
npm run db:seed               # create admin + staff users and import the sample sheet
npm run dev                   # http://localhost:3000
```

> The app uses **Postgres** (e.g. a free [Neon](https://neon.tech) database).
> Deploying to Vercel? See **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)** — the repo
> auto-deploys on every push once connected.

**Demo login:** `admin@eaglestone.com` / `helios123` (also `staff@eaglestone.com`).

The seed imports `data/Ready_to_dispatch.xlsx` (224 real blocks). Since the
seed never attaches real photo files, every block starts in the photo gate
(`NEEDS_PHOTOS`) — the same rule that applies to any newly created or
imported block — and only appears in live inventory once a real photo is
added, via a single upload or the Bulk Photo Room.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run start` | Production server |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Seed users + sample import |
| `npm run backup` | Copy the SQLite DB into `/backups`, prune >30 days |

### Daily backups

Wire the backup script to cron (SQLite is a single file, so a copy is a
consistent snapshot):

```cron
0 2 * * *  cd /path/to/eaglestone-inventory && npm run backup
```

Admins can also download an on-demand snapshot from `GET /api/backup`.

## Tech notes

- **Auth**: signed JWT session cookie (`jose`) + `bcryptjs`; route protection in
  `src/middleware.ts`. All routes are gated except `/login`.
- **Optimistic concurrency**: every `Block` carries a `version`; edits and status
  changes fail with a stale-edit warning if the version moved underneath you.
- **Soft delete**: `deletedAt` + a 30-day Trash with restore / admin purge.
- **Import safety**: the whole import runs in one Prisma transaction; blocking
  validation errors (duplicate block numbers, negative values) abort everything.
  A blank colour cell is a non-blocking warning (imported as `UNSPECIFIED`).
- **Database**: SQLite for zero-config Phase 1; the schema ports cleanly to
  Postgres — swap the `datasource` provider and `DATABASE_URL`.
- **Design**: EAGLE brand tokens (tan / brown / cream) via Tailwind.

Photos are stored under `public/uploads/` (git-ignored); staged review-room
files live in `public/uploads/_staging/` until a batch is committed.
