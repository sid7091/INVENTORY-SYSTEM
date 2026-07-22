"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { clearAllPhotoFiles } from "@/lib/storage";
import { CLEAR_DATA_CONFIRM_PHRASE } from "@/lib/constants";
import type { ActionResult } from "./blocks";

export interface DataCounts {
  blocks: number;
  photos: number;
  photoBatches: number;
  auditLogs: number;
  actionItems: number;
}

export async function getDataCounts(): Promise<DataCounts> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { blocks: 0, photos: 0, photoBatches: 0, auditLogs: 0, actionItems: 0 };
  const [blocks, photos, photoBatches, auditLogs, actionItems] = await Promise.all([
    prisma.block.count(),
    prisma.photo.count(),
    prisma.photoBatch.count(),
    prisma.auditLog.count(),
    prisma.actionItem.count(),
  ]);
  return { blocks, photos, photoBatches, auditLogs, actionItems };
}

// Wipes every block, photo, piece allocation, photo batch and audit log entry.
// User accounts are intentionally preserved — this is a data reset, not a
// factory reset, and staff must still be able to log back in afterwards.
export async function clearAllData(confirmText: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only admins can clear all data." };
  if (confirmText.trim() !== CLEAR_DATA_CONFIRM_PHRASE) {
    return { ok: false, error: `Type "${CLEAR_DATA_CONFIRM_PHRASE}" exactly to confirm.` };
  }

  const counts = await getDataCounts();
  if (counts.blocks === 0 && counts.photos === 0 && counts.auditLogs === 0) {
    return { ok: false, error: "There is no data to clear." };
  }

  // Explicit child-first deletion — safe regardless of DB-level cascade support.
  // AppSetting is deliberately NOT wiped — it's configuration (the Drive
  // folder link), not inventory data.
  await prisma.$transaction([
    prisma.pieceAllocation.deleteMany(),
    prisma.photo.deleteMany(),
    prisma.slab.deleteMany(),
    prisma.photoBatchItem.deleteMany(),
    prisma.photoBatch.deleteMany(),
    prisma.actionItem.deleteMany(),
    prisma.driveImportedFile.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.block.deleteMany(),
  ]);

  // Best-effort file cleanup — the DB is already clean either way.
  await clearAllPhotoFiles().catch(() => {});

  // Write a single fresh audit entry so there's a record the reset happened.
  await logAudit(prisma, {
    action: "DATA_WIPE",
    userId: user.userId,
    reason: `Cleared all data: ${counts.blocks} blocks, ${counts.photos} photos, ${counts.auditLogs} audit entries removed`,
  });

  revalidatePath("/", "layout");
  return { ok: true };
}
