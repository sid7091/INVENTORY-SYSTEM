# Helios Slab Library — Website Build Guide

> **For Claude Code.** This file describes a website that replaces the "Helios Slab Library" Claude artifact. Build it in the phases below, keep it easy to change, and copy the "Project rules" section into `CLAUDE.md` at the start so future edits follow the same conventions.

---

## 1. What this is

An internal tool for **Helios Stone** (exotic marble, quartzite, granite, quartz and onyx). The sales team uses it on their phones to:

1. Keep a library of stone slabs (blocks), each with photos and renders.
2. Find a slab quickly by **name, material, colour or block number**.
3. **Share** slab photos straight to WhatsApp, or **save** them to the phone, with the slab details printed on each photo.
4. Select several slabs and generate a **client PDF** in the Helios "Stone For You" template.
5. Add, edit and remove slabs (remove when a slab is sold).

Mobile-first. Most use is on a phone, one-handed, in a showroom or warehouse.

Reference material, to be supplied with this file:
- `slab-library.html`: the current artifact. It is a working reference for UI, search, the PDF layout and the photo band. Reuse its logic where it helps, but do **not** copy its `window.claude.*` runtime calls; those only work inside Claude.
- `helios-slab-library-export-YYYY-MM-DD.zip`: all current data and photos (see section 11).
- `Helios_Stone_For_You_Template.pdf`: the brand template the PDF must match.

---

## 2. Tech stack

Pick boring, well-documented tools so changes stay easy.

| Part | Choice | Why |
|---|---|---|
| Frontend | **Vite + React + TypeScript** | Simple, fast, easy for Claude Code to edit |
| Styling | Plain CSS with CSS variables (one `theme.css`) | Brand colours change in one place |
| Database, file storage and login | **Supabase** (Postgres + Storage + Auth) | Real logins with passwords, roles, and a database that can enforce unique block numbers |
| PDF | **jsPDF** in the browser | Same engine as the current artifact; no server needed |
| Hosting | **Netlify** (static site) | Already used by Helios; automatic deploys from GitHub |

Environment variables (`.env`, never committed):
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```
Commit a `.env.example` with the same keys and empty values.

---

## 3. Project rules (copy into `CLAUDE.md`)

- **All brand settings live in `src/config/brand.ts`**: colours, fonts, the category line, PDF texts, the thank-you paragraph, and the asset paths. No colour hex codes or brand text anywhere else.
- **All PDF layout numbers live in `src/pdf/layout.ts`.** The PDF code reads positions from there, so changing the layout means editing numbers, not logic.
- One feature per folder: `src/features/library`, `src/features/slab`, `src/features/editor`, `src/features/share`, `src/features/pdf`.
- Keep components small, under about 200 lines. Put data access in `src/lib/db.ts` only.
- Every database change goes in a new SQL migration file in `supabase/migrations/`. Never edit an old migration.
- Before finishing any change: run `npm run typecheck` and `npm run build`, and test on a 375px-wide mobile viewport.
- Plain, friendly UI wording. Errors say what happened and what to do next.

---

## 4. Users and roles

Login is **email + password** (Supabase Auth). There is no public sign-up; an admin invites people.

| Role | Can do |
|---|---|
| `viewer` | Search, view, save and share photos, create PDFs |
| `editor` | Everything a viewer can, plus add and edit slabs, and mark slabs as sold or removed |
| `admin` | Everything an editor can, plus invite users and change roles (simple **Team** page) |

Store the role in a `profiles` table (`id` = auth user id, `full_name`, `role`). Enforce it with **Row Level Security**, not only in the UI.

Unauthenticated visitors see only the login page.

---

## 5. Data model

### `slabs`
| Column | Type | Rules |
|---|---|---|
| `id` | uuid, PK | default `gen_random_uuid()` |
| `name` | text | **required** |
| `material` | text | optional; stored in Title Case (e.g. `Quartzite`) |
| `color` | text | optional (e.g. `Gold, blue, rust`) |
| `size` | text | **required**, free text (e.g. `119 x 74`) |
| `quantity` | text | optional (e.g. `6 slabs`) |
| `block` | text | **required**, as typed (e.g. `29596 / HCS 593`) |
| `status` | text | `available` (default) or `sold` |
| `created_at`, `updated_at`, `created_by` | | standard |

### `slab_images`
| Column | Type | Rules |
|---|---|---|
| `id` | uuid, PK | |
| `slab_id` | uuid → `slabs.id` | on delete cascade |
| `path` | text | Supabase Storage path in bucket `slab-images` |
| `label` | text | optional (`Slab`, `Kitchen`, `Bathroom`, `Bar`…) |
| `position` | int | **0 = cover photo (the plain slab photo)**; 1+ = renders |

### `block_keys` — prevents duplicate block numbers
A block field can hold several numbers: `29596 / HCS 593` means two keys, `29596` and `hcs593`.

| Column | Type | Rules |
|---|---|---|
| `key` | text | **PRIMARY KEY**, so the database refuses duplicates |
| `slab_id` | uuid → `slabs.id` | on delete cascade |

**Key rule.** Split the block text on `/ , ; | & +` or the word `and`. For each part, lowercase it, strip accents, and remove everything except a–z and 0–9. Keep parts that are 2 or more characters long.
`"29596 / HCS 593"` → `["29596", "hcs593"]`.

Write this rule **once**, as a Postgres function `block_keys_of(text)`. Use it in two places:
- a trigger, so that saving a slab rewrites its rows in `block_keys`; and
- an RPC `check_block(block text, exclude_id uuid)`, which the editor calls as the user types.

If an insert hits the primary key, the save fails and the UI shows:
**"Already in the library: {name} (Block {block})."**

### Storage
- Bucket `slab-images`, private. Read access for logged-in users; write and delete access for editors and admins.
- Show photos with signed URLs, or with Supabase image transforms for thumbnails.

---

## 6. Screens

### 6.1 Library (home)
- Header: "Slab library" and a count (e.g. "71 slabs"). For editors and admins, show an **Add slab** floating button.
- **Search box**, sticky at the top. It matches if every typed word appears in name, material, colour, size or block. It also matches the query with spaces and punctuation removed against the same fields squashed together, so `hcs593`, `HCS 593` and `29596` all find Escuro Na Noite.
- **Material chips** below the search: "All" plus each material in the data.
- **Status filter**: Available (default), Sold, All.
- **Grid of cards**: cover photo (4:3), name, material, block no. Each card has a round **tick** in the corner to select it for a PDF.
- When one or more cards are ticked, show a bottom bar: **"N slabs selected · Clear · Create PDF"**. The selection survives searching and filtering.

### 6.2 Slab detail
- Name (large), then a details list: Material, Colour, Size, Quantity, Block no. Hide empty fields.
- A **Copy details** link copies the WhatsApp caption (section 8.3).
- All photos stacked full-width. Each photo has a label chip and two buttons: **⤓ Save** and **↗ Share**.
- Bottom bar: **Save all**, **Share all**, **Add to PDF / Remove from PDF**.
- For editors and admins: **Edit** and **Sold · Remove** at the top.

### 6.3 Add / Edit slab
- Fields: Name\*, Material (with suggestions from existing materials), Size\*, Colour, Quantity, Block no.\*
- A **live duplicate warning** under the block field, from `check_block`, as the user types.
- **Photo picker**, which must work on iPhone and Android:
  - `<input type="file" accept="image/*" multiple>`, made full-size and transparent over the drop zone (not `display:none`).
  - Before upload, convert every photo to **JPEG, longest side 2400px, quality 0.86** in a canvas. This turns iPhone HEIC photos into JPEG. If the browser can't decode a HEIC file, show: "This photo couldn't be read. On iPhone set Settings → Camera → Formats → Most Compatible."
  - Thumbnails with a label box, **↑ make cover**, and **✕ remove**. The first image is the cover.
  - Show upload progress: "Uploading image 2 of 4…".
- Save is blocked until the required fields are filled and the block no. is free.
- When editing, delete removed images from Storage after a successful save.

### 6.4 Sold · Remove
- A confirmation dialog: **"{name} (Block {block}) and its photos will be removed from the library for everyone. This can't be undone."**
- Buttons: **Remove listing** (red) and **Keep it**.
- *Improvement over the artifact:* also offer **Mark as sold**, which sets `status = sold` and keeps history. Sold slabs are hidden from the default view and from PDFs. Hard delete is for admins only.

### 6.5 Team (admin only)
- List users with their roles, invite by email, and change roles.

---

## 7. Look and feel

Defined in `src/config/brand.ts` and `theme.css`.

| Token | Value | Use |
|---|---|---|
| `navy` | `#0A213A` | Brand background, PDF pages |
| `cream` | `#EAE4D8` | PDF footer band, accents |
| `white` | `#FCFAF7` | Text on navy |
| `bg` (app, light) | `#E7E5E1` | App background |
| `surface` | `#F6F5F2` | Cards |
| `ink` | `#1E1C19` | Text |
| `muted` | `#6B665E` | Secondary text |
| `amber` | `#B8761E` | Primary buttons, selection |
| `rust` | `#9A3F1E` | Destructive actions |

- App fonts: **Marcellus** for headings and **Instrument Sans** for body text, from Google Fonts, with system-font fallbacks.
- Support dark mode with `prefers-color-scheme`.
- Respect phone safe areas (`env(safe-area-inset-*)`). All tap targets at least 44px.

---

## 8. Save and share photos

### 8.1 Branded photo
Each photo is saved or shared with a **navy band added under the image**. The image itself is never covered.

- Canvas width = photo width, scaled so the longest side is at most 2400px. Band height = `max(width × 0.085, 90px)`. Padding = band × 0.32.
- Band colour: navy `#0A213A`. Draw the **Helios main logo** (cream) on the right, at band × 0.72 tall, centred vertically.
- **Line 1:** the slab **NAME** in uppercase, bold, white, font size band × 0.34, baseline at band × 0.47.
- **Line 2:** `SIZE : 119 X 74     |     BLOCK NO : 29596 / HCS 593` in uppercase, regular, cream, font size band × 0.20.
- Shrink the font size if a line would run into the logo.
- Font: **DejaVu Sans**, regular and bold, loaded with `FontFace` from `/brand/`.
- Output: JPEG at quality 0.9.

**File name:** `{Name} - {Size} - Block {Block} - {Label or index}.jpg`, with the characters `\ / : * ? " < > |` removed.

### 8.2 Share
- Prepare the branded files **as soon as a slab is opened**. Phones only allow the share sheet to open straight from a tap, so the files must already be ready.
- Use `navigator.share({ files, text: caption })`. Check `navigator.canShare({ files })` first.
- If sharing files isn't supported, fall back to downloading the files and tell the user to send them from the gallery.
- Always copy the caption to the clipboard as well, because WhatsApp sometimes drops shared text.
- **Share all** sends every photo of the slab in one share.

### 8.3 WhatsApp caption
```
*Escuro Na Noite*
Material: Quartzite
Colour: Gold, yellow
Size: 119 x 74
Quantity: 6 slabs
Block no: 29596 / HCS 593
```
Leave out any line whose field is empty.

### 8.4 Save
Download the branded JPEG or JPEGs. On Android they appear in the Gallery under Downloads. On iPhone, opening the share sheet with **Save Image** is the better path, so offer Share as the primary action on iOS.

---

## 9. Client PDF — "Stone For You" template

Generated in the browser with jsPDF.

**Page setup:** 16:9, **960 × 540 pt**, landscape. All coordinates below are in pt from the top-left corner, and text is placed with `baseline: "top"`.

**Fonts:** embed **DejaVu Sans** (regular and bold) from `/brand/` using `addFileToVFS` and `addFont`. The thank-you paragraph uses Helvetica.

**Inputs from the dialog:** client name (optional), location (optional), and **"Add a renders page after each slab"** (checkbox, on by default).

**File name:** `Helios - Stone For You - {Client} {Location}.pdf`

### Page order
1. Logo page
2. "Stone For You" page
3. For each selected slab, in library order:
   - its **product page**, then
   - its **renders page(s)**, only if renders are switched on and the slab has renders
4. Thank You page
5. Building photo page

### 9.1 Logo page
- Full navy background.
- `brand/logo-main.png` at x 277.9, y 58.3, size 406.8 × 406.8.

### 9.2 "Stone For You" page
- Full navy background.
- `Stone`, `For`, `You` in bold 81pt, white, at x 339.1 and y 150.8, 228.7 and 306.7.
- `BY TEAM HELIOS` in regular 18pt, cream, letter spacing 2.6, at x 339.1, y 390.8.
- If a client name was given: `CURATED FOR  {CLIENT}` in 12.5pt, cream, letter spacing 1.2, at x 339.1, y 440. If a location was given, put it on the next line, 22pt lower.

### 9.3 Product page (one per slab)
- Navy background. A **cream footer band** from y 462.8 to 540.
- Footer: `brand/logo-footer.png` at x 24.5, y 469.4, size 59 × 59. Then `QUARTZITES   I   IMPORTED MARBLE   I   GRANITE   I   QUARTZ   I   ONYX` in navy 15.3pt, letter spacing 1.1, at x 216.2, y 488.3.
- Left column, white text, x 54:
  - `BLOCK NO : {BLOCK}`: 16pt, letter spacing 1.2, at y 28.4. One line only, max width 250.
  - **NAME** in uppercase: 24.7pt, wrapped at width 250, line height 39.1. Start at y 198.2 for 1–2 lines; for 3–4 lines, start at `230 − lines × 19.5`.
  - Bottom lines, 15.5pt, letter spacing 1, line gap 35.9, **with the last line at y 422.2**. The lines are, skipping any that are empty: `{MATERIAL}`, `COLOR : {COLOR}`, `SIZE : {SIZE}`, `QUANTITY : {QUANTITY}`.
- **Slab photo** (the cover image): box at x 334.7, y 25.2, size 546.2 × 409.6. Crop it to fill the box exactly, centred.

### 9.4 Renders page
- Same navy background and **same cream footer** as the product page.
- **No text at all** on the navy area: no block no., no name, no labels.
- Layout area: x 54, y 25.2, w 852, h 409.6, with a gap of 10.
- Up to 4 renders per page. Every tile is the **same size**, with a **3:2** ratio and cover-crop.
- Choose the column count that gives the largest tiles. Centre each row horizontally and centre the whole grid vertically.
  - 1 render → one tile of about 614 × 409.6
  - 2 → side by side
  - 3 → two on top, one centred below
  - 4 → 2 × 2
- More than 4 renders → continue onto further renders pages.

### 9.5 Thank You page
- Navy background.
- `Thank` and `You` in bold 103.5pt, white, at x 318.9 and y 142.2 and 240.6.
- `BY TEAM HELIOS` in 22.9pt, cream, letter spacing 3.2, at x 318.9, y 357.
- The paragraph below, in Helvetica 13.7pt, cream, centred at x 480, starting at y 410.2 with a line step of 16.45:
  > Thank you for your interest in our unique stone collection! Each piece is one-of-a-kind,
  > showcasing distinct characteristics. Please note that the images represent the essence
  > of our stones only.

### 9.6 Building page
- `brand/building.jpg`, full bleed, 960 × 540, cover-cropped.

### Image handling
Before calling `addImage`, crop each image in a canvas to its box ratio, at about 2.4× the box width (max 1800px), as JPEG quality 0.86. This keeps the PDF small enough to send on WhatsApp.

---

## 10. Folder layout

```
helios-slab-library/
├─ CLAUDE.md                  ← copy of section 3, plus any notes
├─ README.md                  ← setup, deploy, how to add a user
├─ .env.example
├─ netlify.toml               ← build: npm run build, publish: dist, SPA redirect
├─ public/brand/              ← logo-main.png, logo-footer.png, building.jpg, DejaVuSans*.ttf
├─ supabase/migrations/       ← 001_init.sql (tables, block_keys, RLS, storage policies)
├─ scripts/import-export.ts   ← one-off import of the artifact export zip
└─ src/
   ├─ config/brand.ts         ← colours, texts, category line, asset paths
   ├─ lib/db.ts               ← all Supabase calls
   ├─ lib/blockKeys.ts        ← same key rule as SQL, for instant UI feedback
   ├─ lib/images.ts           ← compress/convert, crop-to-box, branded photo
   ├─ pdf/layout.ts           ← every PDF coordinate from section 9
   ├─ pdf/buildPdf.ts
   ├─ features/{library,slab,editor,share,pdf,team,auth}/
   └─ theme.css
```

---

## 11. Moving the data from the artifact

1. In the Claude artifact, sign in as an editor and tap **Export library (.zip)** at the top. You get `helios-slab-library-export-YYYY-MM-DD.zip` containing:
   - `slabs.json`: every slab, with `name`, `material`, `color`, `size`, `quantity`, `block`, `createdAt`, `updatedAt`, `legacyId`, and `images[]` (`file`, `label`, `isCover`)
   - `images/…`: the original photos, in order (cover first)
   - `brand/…`: logos, the building photo, and the fonts. Copy these into `public/brand/`.
2. Write `scripts/import-export.ts`. It should:
   - read `slabs.json`;
   - upload each image to the `slab-images` bucket;
   - insert the slab and its images, with `position` = array index;
   - keep `created_at` from `createdAt` (milliseconds);
   - **skip and log** any slab whose block key already exists, instead of failing the whole import;
   - print a summary at the end: imported, skipped, and missing photos.
3. Run it with the Supabase **service role key**, from the local machine only and never in the browser. Check the totals against the export: 71 slabs at the time this guide was written.
4. Known data issues to report during import, not to fix silently:
   - one slab has an empty size (`VENATINO WHITE`, block `UM25/HDS537`);
   - one slab has no photos (`Black Arabescato`, block `M7/HES120`);
   - some slabs share a name but have different blocks (e.g. several `Statuario`, `Arctic Whisper`, `Ice white`). This is expected; don't merge them.

---

## 12. Build phases

Finish each phase, deploy it, and check it on a phone before starting the next.

1. **Foundation:** Vite + React + TS app, Supabase project, migration `001_init.sql`, login page, roles, Netlify deploy.
2. **Library:** list, search, material chips, status filter, slab detail.
3. **Editor:** add and edit, photo picker with conversion, required fields, duplicate check in the UI and database, Sold · Remove.
4. **Import:** script, run against the export, verify counts.
5. **Save and share:** branded photo, share sheet, save, copy caption.
6. **PDF:** selection bar, dialog, all page types from section 9. Compare against `Helios_Stone_For_You_Template.pdf` side by side.
7. **Team page and polish:** invite users, roles, dark mode, empty and error states.

---

## 13. Done when

- [ ] Logging in is required; viewers can't add, edit or remove, even by calling the API directly (RLS).
- [ ] Searching `29596`, `hcs593` or `HCS 593` finds Escuro Na Noite.
- [ ] Adding a slab with block `HCS 593` (or `29596`) is refused, with the existing slab named.
- [ ] Two people saving the same block number at the same moment can't both succeed (enforced by the database).
- [ ] Name, size and block no. are required.
- [ ] An iPhone HEIC photo uploads correctly as JPEG.
- [ ] **Share all** on a phone opens the share sheet with all photos, each with the navy band showing name, size and block.
- [ ] The PDF for 3 slabs with renders has, in order: logo, Stone For You (with client), product page, renders page for each slab, Thank You, building. It visually matches the template.
- [ ] The renders page has no text and equal-size tiles, and nothing important is cropped out of the bathroom render.
- [ ] Marking a slab as sold hides it from the library and from PDFs.
- [ ] All 71 slabs and their photos were imported.
- [ ] Lighthouse mobile performance 80+; works on a 375px-wide screen.

---

## 14. Ideas for later

These are not part of the first build:
- A public "share link" per PDF, so clients open it in a browser instead of downloading.
- Price and finish fields.
- Bulk upload from a folder.
- An activity log of who added, edited or sold what.
