import { requireUser } from "@/lib/auth";
import { promises as fs } from "fs";
import path from "path";
import { brandSlug } from "@/lib/brand";

// On-demand backup: streams the SQLite database file as a download. Combined
// with scripts/backup.ts (cron) this covers the daily-backup requirement.
export async function GET() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });

  const dbPath = path.join(process.cwd(), "prisma", "dev.db");
  try {
    const buf = await fs.readFile(dbPath);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${brandSlug()}-backup-${stamp}.db"`,
      },
    });
  } catch (e) {
    return new Response(`Backup failed: ${(e as Error).message}`, { status: 500 });
  }
}
