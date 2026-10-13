// One-off import of the Claude artifact export.
//
//   npm run import -- path/to/helios-slab-library-export-YYYY-MM-DD.zip
//
// Run on your own computer with DATABASE_URL (and BLOB_READ_WRITE_TOKEN for the
// hosted site) set in .env. Never run this in the browser.
// - Uploads every photo (cover first), resized like the app does.
// - Skips and logs any slab whose block no. is already in the library, so the
//   import can safely be run again.
// - Copies brand/ files (logos, building photo, fonts) into public/brand/.
// - Reports data problems instead of silently fixing them.

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { PrismaClient } from "@prisma/client";
import { titleCase, clean } from "../src/lib/text";
import { insertSlab, storePhoto } from "./photoFiles";

interface ExportedSlab {
  name: string;
  material?: string;
  color?: string;
  size?: string;
  quantity?: string;
  block?: string;
  createdAt?: number;
  updatedAt?: number;
  legacyId?: string;
  images?: { file: string; label?: string; isCover?: boolean }[];
}

const prisma = new PrismaClient();

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) throw new Error("Usage: npm run import -- path/to/export.zip");
  const zip = await JSZip.loadAsync(await readFile(zipPath));
  const find = (name: string) => zip.file(name) ?? zip.file(new RegExp(`(^|/)${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`))[0] ?? null;

  const json = find("slabs.json");
  if (!json) throw new Error("slabs.json wasn't found in the zip.");
  const raw = JSON.parse(await json.async("string"));
  const slabs: ExportedSlab[] = Array.isArray(raw) ? raw : raw.slabs;

  // Brand files → public/brand/
  const brandDir = path.join(process.cwd(), "public", "brand");
  await mkdir(brandDir, { recursive: true });
  const brandFiles = Object.values(zip.files).filter((f) => !f.dir && /(^|\/)brand\//.test(f.name));
  for (const f of brandFiles) await writeFile(path.join(brandDir, path.basename(f.name)), await f.async("nodebuffer"));
  if (brandFiles.length) console.log(`Copied ${brandFiles.length} brand files into public/brand/: ${brandFiles.map((f) => path.basename(f.name)).join(", ")}`);

  const report = { imported: 0, skipped: [] as string[], noSize: [] as string[], noPhotos: [] as string[], missingFiles: [] as string[] };
  const names = new Map<string, number>();

  for (const [i, s] of slabs.entries()) {
    const label = `${s.name} (Block ${s.block || "—"})`;
    process.stdout.write(`[${i + 1}/${slabs.length}] ${label} … `);
    if (!clean(s.name) || !clean(s.block)) {
      report.skipped.push(`${label}: no name or block no.`);
      console.log("skipped (no name or block)");
      continue;
    }
    if (!clean(s.size)) report.noSize.push(label);
    names.set(s.name.trim().toLowerCase(), (names.get(s.name.trim().toLowerCase()) ?? 0) + 1);

    const res = await insertSlab(prisma, {
      name: clean(s.name)!,
      material: clean(s.material) ? titleCase(clean(s.material)!) : null,
      color: clean(s.color),
      size: clean(s.size) ?? "",
      quantity: clean(s.quantity),
      block: clean(s.block)!,
      createdAt: s.createdAt ? new Date(s.createdAt) : undefined,
      updatedAt: s.updatedAt ? new Date(s.updatedAt) : undefined,
    });
    if (!res.slab) {
      report.skipped.push(`${label}: block already used by ${res.clash.name} (Block ${res.clash.block})`);
      console.log("skipped (duplicate block)");
      continue;
    }

    const images = [...(s.images ?? [])].sort((a, b) => Number(!!b.isCover) - Number(!!a.isCover));
    let position = 0;
    for (const img of images) {
      const file = find(img.file) ?? find(`images/${path.basename(img.file)}`);
      if (!file) {
        report.missingFiles.push(`${label}: ${img.file}`);
        continue;
      }
      const stored = await storePhoto(await file.async("nodebuffer"));
      await prisma.slabImage.create({ data: { ...stored, slabId: res.slab.id, label: clean(img.label), position: position++ } });
    }
    if (position === 0) report.noPhotos.push(label);
    report.imported++;
    console.log(`ok (${position} photos)`);
  }

  const sameName = [...names.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} ×${n}`);
  console.log("\n================ Import summary ================");
  console.log(`In the export:   ${slabs.length}`);
  console.log(`Imported:        ${report.imported}`);
  console.log(`Skipped:         ${report.skipped.length}`);
  report.skipped.forEach((s) => console.log(`   - ${s}`));
  console.log(`Missing photos:  ${report.missingFiles.length}`);
  report.missingFiles.forEach((s) => console.log(`   - ${s}`));
  console.log("\nPlease check (imported, not changed):");
  console.log(`   No size:       ${report.noSize.join("; ") || "none"}`);
  console.log(`   No photos:     ${report.noPhotos.join("; ") || "none"}`);
  console.log(`   Same name, different blocks (expected): ${sameName.join("; ") || "none"}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
