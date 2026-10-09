// npm run db:seed
// Also runs on every Vercel deploy (see "vercel-build"), so it must be safe to
// repeat: it never changes an existing admin or adds demo slabs twice.
// 1. Creates the first admin (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD) if missing.
// 2. If the library is empty, adds 3 demo slabs (from the Chaitanya selection
//    PDF) so there's something to look at. Set SEED_DEMO=false to skip.

import { readFile } from "fs/promises";
import path from "path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { insertSlab, storePhoto } from "../scripts/photoFiles";

const prisma = new PrismaClient();

const DEMO = [
  {
    name: "Escuro Na Noite", material: "Quartzite", color: "Gold, yellow", size: "119 x 74", quantity: null, block: "29596 / HCS 593",
    photos: [["escuro-1-slab.jpg", "Slab"], ["escuro-2-bathroom.jpg", "Bathroom"], ["escuro-3-bar.jpg", "Bar"], ["escuro-4-kitchen.jpg", "Kitchen"]],
  },
  {
    name: "Patagonia", material: "Quartzite", color: null, size: "124 x 79", quantity: null, block: "3143",
    photos: [["patagonia-1-slab.jpg", "Slab"], ["patagonia-2-exterior.jpg", "Exterior"], ["patagonia-3-lobby.jpg", "Lobby"], ["patagonia-4-kitchen.jpg", "Kitchen"]],
  },
  {
    name: "Emerald green", material: "Quartzite", color: null, size: "128 x 80", quantity: null, block: "BL280 / HES 511",
    photos: [["emerald-1-slab.jpg", "Slab"], ["emerald-2-living-room.jpg", "Living room"], ["emerald-3-bathroom.jpg", "Bathroom"]],
  },
];

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "").toLowerCase().trim();
  const password = process.env.SEED_ADMIN_PASSWORD || "";
  const existing = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!email || password.length < 8) {
    console.warn("No first admin created: set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (8+ characters).");
  } else if (existing) {
    console.log(`Admin ${email} already exists — left unchanged.`);
  } else {
    await prisma.user.create({
      data: { email, name: "Helios Admin", role: "admin", status: "active", approvedAt: new Date(), passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Created admin ${email}.`);
  }

  if (process.env.SEED_DEMO === "false" || (await prisma.slab.count()) > 0) return;
  const now = Date.now();
  for (const [i, d] of DEMO.entries()) {
    const { photos, ...fields } = d;
    const res = await insertSlab(prisma, { ...fields, createdAt: new Date(now - i * 60_000) });
    if (!res.slab) continue;
    for (const [position, [file, label]] of photos.entries()) {
      const stored = await storePhoto(await readFile(path.join(__dirname, "demo", file)));
      await prisma.slabImage.create({ data: { ...stored, slabId: res.slab.id, label, position } });
    }
    console.log(`Added demo slab ${d.name}.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
