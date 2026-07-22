import { logAudit } from "@/lib/audit";

// Attach a photo to a block. The FIRST photo auto-promotes the block out of the
// NEEDS_PHOTOS gate into IN_STOCK (the "photo gate" rule). Shared between the
// manual upload actions and the automatic Google Drive sync.
export async function attachPhoto(
  tx: import("@prisma/client").Prisma.TransactionClient,
  blockId: string,
  userId: string | null,
  file: { url: string; filename: string },
): Promise<{ promoted: boolean }> {
  const block = await tx.block.findUnique({ where: { id: blockId }, include: { _count: { select: { photos: true } } } });
  if (!block) throw new Error("Block not found");
  const isFirst = block._count.photos === 0;
  await tx.photo.create({
    data: { blockId, url: file.url, filename: file.filename, isPrimary: isFirst },
  });
  let promoted = false;
  if (block.status === "NEEDS_PHOTOS") {
    await tx.block.update({ where: { id: blockId }, data: { status: "IN_STOCK", version: { increment: 1 } } });
    await logAudit(tx, {
      action: "STATUS_CHANGE",
      userId,
      blockId,
      reason: "Auto-promoted: first photo attached (photo gate cleared)",
      changes: { status: { from: "NEEDS_PHOTOS", to: "IN_STOCK" } },
    });
    promoted = true;
  }
  await logAudit(tx, { action: "PHOTO_ADD", userId, blockId, reason: `Photo added: ${file.filename}` });
  return { promoted };
}
