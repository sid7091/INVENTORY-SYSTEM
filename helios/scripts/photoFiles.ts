// Shared by the seed and the import script (both run on your own computer,
// never in the browser): resize a photo like the app does and store it.

import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { blockKeysOf } from "../src/lib/blockKeys";
import { putImage } from "../src/lib/storage";

export async function storePhoto(input: Buffer) {
  const img = sharp(input, { failOn: "none" }).rotate(); // respect phone orientation
  const full = await img.clone().resize(2400, 2400, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer({ resolveWithObject: true });
  const thumb = await img.clone().resize(640, 640, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
  const [path, thumbPath] = await Promise.all([putImage(full.data), putImage(thumb)]);
  return { path, thumbPath, width: full.info.width, height: full.info.height };
}

export interface NewSlab {
  name: string;
  material: string | null;
  color: string | null;
  size: string;
  quantity: string | null;
  block: string;
  createdAt?: Date;
  updatedAt?: Date;
}

/** Inserts a slab with its block keys. Returns null if the block is already used. */
export async function insertSlab(prisma: PrismaClient, s: NewSlab) {
  const keys = blockKeysOf(s.block);
  const clash = await prisma.blockKey.findFirst({ where: { key: { in: keys } }, include: { slab: true } });
  if (clash) return { clash: clash.slab };
  const slab = await prisma.slab.create({
    data: { ...s, blockKeys: { create: keys.map((key) => ({ key })) } },
  });
  return { slab };
}
