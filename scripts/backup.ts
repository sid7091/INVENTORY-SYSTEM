// Daily backup script. Copies the SQLite database (and prunes backups older
// than 30 days) into /backups. Wire it to cron:
//
//   0 2 * * *  cd /path/to/app && npm run backup
//
import { promises as fs } from "fs";
import path from "path";
import { brandSlug } from "../src/lib/brand";

async function main() {
  const root = process.cwd();
  const dbPath = path.join(root, "prisma", "dev.db");
  const backupDir = path.join(root, "backups");
  await fs.mkdir(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(backupDir, `${brandSlug()}-${stamp}.db`);
  await fs.copyFile(dbPath, dest);
  console.log(`✔ Backup written: ${dest}`);

  // Prune backups older than 30 days.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const files = await fs.readdir(backupDir);
  let pruned = 0;
  for (const f of files) {
    if (!f.endsWith(".db")) continue;
    const full = path.join(backupDir, f);
    const stat = await fs.stat(full);
    if (stat.mtimeMs < cutoff) {
      await fs.unlink(full);
      pruned++;
    }
  }
  if (pruned) console.log(`✔ Pruned ${pruned} backup(s) older than 30 days.`);
}

main().catch((e) => {
  console.error("Backup failed:", e);
  process.exit(1);
});
