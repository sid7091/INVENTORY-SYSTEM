import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { parseWorkbook } from "../src/lib/excel";
import { PRESET_ROLES } from "../src/lib/permissionDefs";

const prisma = new PrismaClient();

async function main() {
  // Preset roles first — permissions are re-synced on every seed so preset
  // definitions stay current after upgrades. Custom roles are untouched.
  const roleIds: Record<string, string> = {};
  for (const preset of PRESET_ROLES) {
    const role = await prisma.role.upsert({
      where: { name: preset.name },
      update: { permissions: JSON.stringify(preset.permissions), uiMode: preset.uiMode, isPreset: true },
      create: { name: preset.name, permissions: JSON.stringify(preset.permissions), uiMode: preset.uiMode, isPreset: true },
    });
    roleIds[preset.name] = role.id;
  }
  console.log(`✔ Preset roles ready: ${PRESET_ROLES.map((r) => r.name).join(", ")}`);

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@eaglestone.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "helios123";

  const passwordHash = await bcrypt.hash(password, 10);
  // Re-syncs the password/name/role on every seed so changing SEED_ADMIN_PASSWORD
  // and re-seeding actually updates the login (not a no-op for existing users).
  const admin = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, name: "Eagle Admin", role: "ADMIN", roleId: roleIds.Admin, active: true },
    create: { email, name: "Eagle Admin", passwordHash, role: "ADMIN", roleId: roleIds.Admin },
  });
  console.log(`✔ Admin user ready: ${email} (password: ${password})`);

  // Also seed a plain staff user for demoing roles.
  const staffEmail = "staff@eaglestone.com";
  const staffHash = await bcrypt.hash("helios123", 10);
  await prisma.user.upsert({
    where: { email: staffEmail },
    update: { passwordHash: staffHash, name: "Warehouse Staff", role: "STAFF", roleId: roleIds.Staff, active: true },
    create: { email: staffEmail, name: "Warehouse Staff", passwordHash: staffHash, role: "STAFF", roleId: roleIds.Staff },
  });
  console.log(`✔ Staff user ready: ${staffEmail} (password: helios123)`);

  // And a demo factory-floor worker (simple icon-first UI).
  const workerEmail = "worker@eaglestone.com";
  const workerHash = await bcrypt.hash("helios123", 10);
  await prisma.user.upsert({
    where: { email: workerEmail },
    update: { passwordHash: workerHash, name: "Factory Worker", role: "STAFF", roleId: roleIds.Worker, active: true },
    create: { email: workerEmail, name: "Factory Worker", passwordHash: workerHash, role: "STAFF", roleId: roleIds.Worker },
  });
  console.log(`✔ Worker user ready: ${workerEmail} (password: helios123)`);

  // Any pre-existing accounts without a linked role get mapped from their
  // legacy role string, so nobody is left permission-less after the upgrade.
  const unlinked = await prisma.user.findMany({ where: { roleId: null } });
  for (const u of unlinked) {
    await prisma.user.update({
      where: { id: u.id },
      data: { roleId: u.role === "ADMIN" ? roleIds.Admin : roleIds.Staff },
    });
  }
  if (unlinked.length) console.log(`✔ Linked ${unlinked.length} existing user(s) to preset roles.`);

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
