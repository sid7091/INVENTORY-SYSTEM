import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { parseWorkbook } from "../src/lib/excel";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "admin@eaglestone.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "helios123";

  const passwordHash = await bcrypt.hash(password, 10);
  // Re-syncs the password/name/role on every seed so changing SEED_ADMIN_PASSWORD
  // and re-seeding actually updates the login (not a no-op for existing users).
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Eagle Admin", role: "ADMIN", active: true },
    create: { email, name: "Eagle Admin", passwordHash, role: "ADMIN" },
  });
  console.log(`✔ Admin user ready: ${email} (password: ${password})`);

  // Also seed a plain staff user for demoing roles.
  const staffEmail = "staff@eaglestone.com";
  const staffHash = await bcrypt.hash("helios123", 10);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: staffHash, name: "Warehouse Staff", role: "STAFF", active: true },
    create: { email: staffEmail, name: "Warehouse Staff", passwordHash: staffHash, role: "STAFF" },
  });
  console.log(`✔ Staff user ready: ${staffEmail} (password: helios123)`);

  // Optionally import the sample spreadsheet if the DB has no blocks yet.
  const existing = await prisma.block.count();
  if (existing > 0) {
    console.log(`ℹ Blocks already present (${existing}); skipping sample import.`);
    return;
  }

  const samplePath = path.join(process.cwd(), "data", "Ready_to_dispatch.xlsx");
  try {
    const buf = await fs.readFile(samplePath);
    const { rows, errors } = parseWorkbook(buf);
    console.log(`ℹ Parsed ${rows.length} rows from sample (${errors.length} validation notes).`);

    let created = 0;
    for (const r of rows) {
      // The seed never attaches real photo files, so every block must start
      // in the photo gate (NEEDS_PHOTOS) regardless of its spreadsheet
      // category — the same rule createBlock() and the import route enforce.
      // Add real photos afterward (single upload or the Bulk Photo Room) to
      // release each block, exactly as it would work in normal use.
      await prisma.block.create({
        data: {
          blockNo: r.blockNo,
          quarryNo: r.quarryNo,
          colour: r.colour,
          exporter: r.exporter,
          quarry: r.quarry,
          weightTons: r.weightTons,
          lengthCm: r.lengthCm,
          heightCm: r.heightCm,
          pcs: r.pcs,
          endPcs: r.endPcs,
          totalSft: r.totalSft,
          thicknessMm: r.thicknessMm,
          category: r.category,
          // status omitted — defaults to NEEDS_PHOTOS per the schema.
        },
      });
      created++;
    }
    await prisma.auditLog.create({
      data: { action: "IMPORT", userId: admin.id, reason: `Seed import of ${created} blocks from Ready_to_dispatch.xlsx` },
    });
    console.log(`✔ Imported ${created} sample blocks.`);
  } catch (e) {
    console.log(`ℹ No sample spreadsheet imported (${(e as Error).message}).`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
