# Helios Slab Library

A phone-first website for **Helios Stone**. The sales team uses it to keep the
slab library, find a slab by name, material, colour or block number, share
branded photos to WhatsApp, and make "Stone For You" client PDFs. Architects and
customers can get their own login to browse the available slabs.

It is built from `docs/HELIOS_SLAB_LIBRARY_BUILD.md`. `CLAUDE.md` covers the
conventions and where this app differs from that guide.

## Who can do what

| Role | Can do |
|---|---|
| **Admin** | Everything, plus the **Team & clients** page (approve requests, create logins, change roles, reset passwords, switch people off) and **permanent removal** of a slab |
| **Editor** | Add and edit slabs, and mark slabs sold or available again |
| **Viewer** | Search, view (including sold slabs), save and share photos, make PDFs |
| **Architect / Customer** | Clients. They see **available** slabs only, can save and share photos and make PDFs, but can't edit. Their ticked slabs show on the Team page ("N picked") |

**Getting clients in.** There are two ways:
1. They tap **Request access** on the login page. The request waits under *Waiting for approval* until an admin taps **Approve**.
2. An admin taps **+ Add a person** on the Team page. The site creates a password, shown once, with a **Send on WhatsApp** button.

To turn self-registration off, set `allowClientRegistration: false` in `src/config/brand.ts`.
To show an **Enquire on WhatsApp** button to clients, set `whatsappNumber` there too.

## Run it on your computer

You need Node 20+ and a Postgres database (a free [Neon](https://neon.tech) database works).

```bash
cd helios
npm install
cp .env.example .env        # fill in DATABASE_URL, AUTH_SECRET, SEED_ADMIN_*
npx prisma migrate deploy   # create the tables
npm run db:seed             # first admin + 3 demo slabs
npm run dev                 # http://localhost:3000
```

## Put it online (Vercel)

1. On Vercel, go to **Add New → Project** and import `sid7091/INVENTORY-SYSTEM`. Set **Root Directory = `helios`**. This must be a separate project from the Eagle Stone app.
2. Under **Storage**, connect a **Neon** (Postgres) database and a **Blob** store to the project. They add `DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` for you.
3. Under **Settings → Environment Variables**, add these for all environments:
   - `AUTH_SECRET`: any long random string
   - `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`: your first admin login
4. Until this branch is merged, set **Settings → Git → Production Branch = `helios-new-inventory`**.
5. Deploy, or redeploy. Every deploy:
   - runs the database migrations;
   - creates the first admin if it's missing;
   - adds the 3 demo slabs if the library is empty.

   All of this is in `vercel-build`, and none of it overwrites existing data.

Every push to the deployed branch redeploys the site. Add `SEED_DEMO=false` if you don't want the demo slabs.

## Move the 71 slabs from the Claude artifact

1. In the artifact, tap **Export library (.zip)**.
2. From your computer, with `.env` pointing at the **live** database and with `BLOB_READ_WRITE_TOKEN` set:
   ```bash
   npm run import -- ~/Downloads/helios-slab-library-export-YYYY-MM-DD.zip
   ```
   The import:
   - uploads every photo, resized like the app does;
   - skips any slab whose block number is already in the library, so it is safe to re-run;
   - copies the `brand/` files (real logos, building photo) into `public/brand/`. Commit them afterwards.
3. Check the summary. It lists anything imported but worth fixing: a slab with no size (VENATINO WHITE), a slab with no photos (Black Arabescato), and repeated names with different blocks (expected).


## Brand files (`public/brand/`)

| File | Status |
|---|---|
| `logo-main.png`, `logo-footer.png` | **Placeholders.** Replace them with the real logos; the export zip contains them |
| `building.jpg` | **Missing.** The PDF's last page is skipped until it's added |
| `DejaVuSans.ttf`, `DejaVuSans-Bold.ttf` | Ready |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server |
| `npm run typecheck` / `npm run build` | Run both before every change |
| `npm run db:seed` | First admin, plus demo slabs if the library is empty |
| `npm run import -- file.zip` | Import the artifact export |
| `npx prisma migrate dev --name x` | After changing `prisma/schema.prisma` |
| `npx prisma studio` | Browse the database |
