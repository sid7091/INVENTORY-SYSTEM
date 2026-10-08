import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { blockKeysOf } from "./blockKeys";
import { canSeeSold } from "./roles";
import { titleCase, clean } from "./text";
import type { SaveSlabInput, SlabDetail, SlabSummary, UserRow } from "./types";

// All database access lives in this file. Callers check permissions first
// (see src/lib/auth.ts); functions here take the viewer's role where the
// answer depends on it (clients never see sold slabs).

const slabInclude = {
  images: { orderBy: { position: "asc" as const }, select: { id: true, label: true, position: true, width: true, height: true } },
} satisfies Prisma.SlabInclude;

type SlabRow = Prisma.SlabGetPayload<{ include: typeof slabInclude }>;

function toSummary(s: SlabRow): SlabSummary {
  return {
    id: s.id,
    name: s.name,
    material: s.material,
    color: s.color,
    size: s.size,
    quantity: s.quantity,
    block: s.block,
    status: s.status === "sold" ? "sold" : "available",
    coverId: s.images[0]?.id ?? null,
    imageCount: s.images.length,
    createdAt: s.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------- slabs

export async function listSlabs(role: string): Promise<SlabSummary[]> {
  const rows = await prisma.slab.findMany({
    where: canSeeSold(role) ? {} : { status: "available" },
    include: { images: { ...slabInclude.images, take: 1 }, _count: { select: { images: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
  return rows.map((r) => ({ ...toSummary(r), imageCount: r._count.images }));
}

export async function getSlab(id: string, role: string): Promise<SlabDetail | null> {
  const s = await prisma.slab.findUnique({ where: { id }, include: slabInclude });
  if (!s || (!canSeeSold(role) && s.status !== "available")) return null;
  return { ...toSummary(s), images: s.images, updatedAt: s.updatedAt.toISOString() };
}

export async function getSlabsForPdf(ids: string[], role: string): Promise<SlabDetail[]> {
  const rows = await prisma.slab.findMany({
    where: { id: { in: ids }, status: "available" },
    include: slabInclude,
    orderBy: { createdAt: "desc" }, // library order
  });
  void role; // sold slabs never go into a PDF, whoever asks
  return rows.map((s) => ({ ...toSummary(s), images: s.images, updatedAt: s.updatedAt.toISOString() }));
}

export async function listMaterials(): Promise<string[]> {
  const rows = await prisma.slab.findMany({ where: { material: { not: null } }, distinct: ["material"], select: { material: true } });
  return rows.map((r) => r.material!).sort();
}

/** The slab already holding one of these block numbers, if any. */
export async function findBlockConflict(block: string, excludeId?: string) {
  const keys = blockKeysOf(block);
  if (!keys.length) return null;
  const hit = await prisma.blockKey.findFirst({
    where: { key: { in: keys }, ...(excludeId ? { slabId: { not: excludeId } } : {}) },
    include: { slab: { select: { id: true, name: true, block: true } } },
  });
  return hit?.slab ?? null;
}

export class DuplicateBlockError extends Error {}
export class SlabInputError extends Error {}

export function normaliseFields(input: SaveSlabInput) {
  const name = clean(input.name);
  const size = clean(input.size);
  const block = clean(input.block);
  if (!name) throw new SlabInputError("Please add a name.");
  if (!size) throw new SlabInputError("Please add the size.");
  if (!block) throw new SlabInputError("Please add the block no.");
  if (!blockKeysOf(block).length) throw new SlabInputError("The block no. needs at least two letters or numbers.");
  return {
    name,
    size,
    block,
    material: clean(input.material) ? titleCase(clean(input.material)!) : null,
    color: clean(input.color),
    quantity: clean(input.quantity),
  };
}

/**
 * Creates or updates a slab, its photo order and its block keys in one
 * transaction. The BlockKey primary key makes a duplicate block fail here even
 * if two people save at the same moment. Returns the slab id and the storage
 * paths of photos that were removed (delete those after the save succeeds).
 */
export async function saveSlab(input: SaveSlabInput, userId: string): Promise<{ id: string; removedPaths: string[] }> {
  const fields = normaliseFields(input);
  const keys = blockKeysOf(fields.block);
  const imageIds = input.images.map((i) => i.id);

  try {
    return await prisma.$transaction(async (tx) => {
      // Photos must be fresh uploads or already belong to this slab.
      const imgs = await tx.slabImage.findMany({ where: { id: { in: imageIds } } });
      if (imgs.length !== imageIds.length || imgs.some((i) => i.slabId && i.slabId !== input.id)) {
        throw new SlabInputError("Some photos couldn't be found. Please add them again.");
      }

      const slab = input.id
        ? await tx.slab.update({ where: { id: input.id }, data: fields })
        : await tx.slab.create({ data: { ...fields, createdById: userId } });

      await tx.blockKey.deleteMany({ where: { slabId: slab.id } });
      await tx.blockKey.createMany({ data: keys.map((key) => ({ key, slabId: slab.id })) });

      const removed = await tx.slabImage.findMany({ where: { slabId: slab.id, id: { notIn: imageIds } } });
      await tx.slabImage.deleteMany({ where: { id: { in: removed.map((r) => r.id) } } });
      for (const [position, img] of input.images.entries()) {
        await tx.slabImage.update({
          where: { id: img.id },
          data: { slabId: slab.id, position, label: clean(img.label) },
        });
      }
      return { id: slab.id, removedPaths: removed.flatMap((r) => [r.path, r.thumbPath ?? ""]).filter(Boolean) };
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const other = await findBlockConflict(fields.block, input.id);
      throw new DuplicateBlockError(
        other ? `Already in the library: ${other.name} (Block ${other.block}).` : "That block no. is already in the library.",
      );
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      throw new SlabInputError("This slab was removed by someone else.");
    }
    throw e;
  }
}

export async function setSlabStatus(id: string, status: "available" | "sold") {
  await prisma.slab.update({ where: { id }, data: { status, soldAt: status === "sold" ? new Date() : null } });
}

/** Permanently removes a slab. Returns the storage paths to delete. */
export async function deleteSlab(id: string): Promise<string[]> {
  const imgs = await prisma.slabImage.findMany({ where: { slabId: id } });
  await prisma.slab.delete({ where: { id } });
  return imgs.flatMap((i) => [i.path, i.thumbPath ?? ""]).filter(Boolean);
}

export async function getSlabName(id: string) {
  return prisma.slab.findUnique({ where: { id }, select: { name: true, block: true } });
}

// ---------------------------------------------------------------- images

export async function createUploadedImage(data: { path: string; thumbPath: string; width: number; height: number }) {
  return prisma.slabImage.create({ data, select: { id: true } });
}

/** Uploads that never got attached to a slab (e.g. the editor was closed). */
export async function takeStaleUploads(olderThan: Date, ids?: string[]): Promise<string[]> {
  const where = { slabId: null, ...(ids ? { id: { in: ids } } : { createdAt: { lt: olderThan } }) };
  const stale = await prisma.slabImage.findMany({ where });
  await prisma.slabImage.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  return stale.flatMap((s) => [s.path, s.thumbPath ?? ""]).filter(Boolean);
}

/** The stored file for an image, if this person may see it. */
export async function getImageForViewer(id: string, role: string, thumb: boolean) {
  const img = await prisma.slabImage.findUnique({ where: { id }, include: { slab: { select: { status: true } } } });
  if (!img) return null;
  // Unattached uploads are only previewed in the editor.
  if (!img.slab) return canSeeSold(role) ? (thumb ? img.thumbPath ?? img.path : img.path) : null;
  if (!canSeeSold(role) && img.slab.status !== "available") return null;
  return thumb ? img.thumbPath ?? img.path : img.path;
}

// ---------------------------------------------------------------- selection

export async function getSelectionIds(userId: string): Promise<string[]> {
  const rows = await prisma.selection.findMany({
    where: { userId, slab: { status: "available" } },
    select: { slabId: true },
  });
  return rows.map((r) => r.slabId);
}

export async function setSelected(userId: string, slabId: string, selected: boolean) {
  if (selected) {
    await prisma.selection.upsert({ where: { userId_slabId: { userId, slabId } }, create: { userId, slabId }, update: {} });
  } else {
    await prisma.selection.deleteMany({ where: { userId, slabId } });
  }
}

export async function clearSelection(userId: string) {
  await prisma.selection.deleteMany({ where: { userId } });
}

export async function getUserSelection(userId: string) {
  return prisma.selection.findMany({
    where: { userId },
    include: { slab: { select: { id: true, name: true, block: true, status: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------- people

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
}

export async function getUser(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function touchLogin(id: string) {
  await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
}

export async function listUsers(): Promise<UserRow[]> {
  const users = await prisma.user.findMany({
    include: { _count: { select: { selections: true } } },
    orderBy: [{ createdAt: "desc" }],
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    status: u.status,
    phone: u.phone,
    company: u.company,
    city: u.city,
    note: u.note,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    selectionCount: u._count.selections,
  }));
}

export async function createUser(data: {
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  status: string;
  phone?: string | null;
  company?: string | null;
  city?: string | null;
  note?: string | null;
}) {
  return prisma.user.create({
    data: { ...data, email: data.email.toLowerCase().trim(), approvedAt: data.status === "active" ? new Date() : null },
  });
}

export async function updateUser(
  id: string,
  data: Partial<{ role: string; status: string; passwordHash: string; name: string; phone: string | null; company: string | null; city: string | null }>,
) {
  const approved = data.status === "active" ? { approvedAt: new Date() } : {};
  return prisma.user.update({ where: { id }, data: { ...data, ...approved } });
}

export async function deleteUser(id: string) {
  await prisma.user.delete({ where: { id } });
}

export async function countActiveAdmins() {
  return prisma.user.count({ where: { role: "admin", status: "active" } });
}
