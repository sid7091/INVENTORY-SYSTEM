# Helios Slab Library — rules for Claude Code

The full spec is `docs/HELIOS_SLAB_LIBRARY_BUILD.md`. This app follows it, with
these deliberate differences (so it fits the rest of this repo):

- **Next.js 15 (App Router) + Prisma + Postgres**, hosted on **Vercel**, instead
  of Vite + Supabase + Netlify. Logins are our own (bcrypt + signed cookie).
- **Permissions are enforced on the server** (`src/lib/auth.ts` → `requireEditor`,
  `requireAdmin`, …) in every server action and API route. The browser never
  talks to the database, so this replaces Supabase RLS.
- **Duplicate block numbers** are refused by the `BlockKey` table's primary key,
  written in the same transaction as the slab. The key rule lives once, in
  `src/lib/blockKeys.ts`.
- Extra roles **architect** and **customer** (clients): they only ever see
  available slabs, can share photos and make PDFs, and can't edit. They can
  request access at `/register` (waits for admin approval) or an admin creates
  their login on the Team page.

## Project rules

- All brand settings (colours, fonts, texts, asset paths, WhatsApp number,
  registration on/off) live in `src/config/brand.ts`. No hex codes or brand text
  anywhere else — `theme.css` uses the CSS variables injected in `app/layout.tsx`.
- All PDF positions live in `src/pdf/layout.ts`.
- One feature per folder in `src/features/` (library, slab, editor, share, pdf,
  team, auth, ui).
- Keep components small (under ~200 lines). All database access goes through
  `src/lib/db.ts` (scripts in `scripts/` and `prisma/seed.ts` are the exception —
  they run outside Next).
- Who can do what is defined in `src/lib/roles.ts`. Hide buttons with it in the
  UI **and** check on the server.
- Every database change: edit `prisma/schema.prisma`, then
  `npx prisma migrate dev --name <what-changed>`. Never edit an old migration.
- Photos are only served through `/api/img/[id]` (login checked; clients can't
  see sold slabs' photos).
- Before finishing any change: `npm run typecheck` and `npm run build`, and check
  a 375px-wide mobile viewport.
- Plain, friendly wording. Errors say what happened and what to do next.
