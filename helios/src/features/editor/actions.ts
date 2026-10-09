"use server";

import { revalidatePath } from "next/cache";
import { NotAllowedError, requireEditor, requireHardDelete, requireUser } from "@/lib/auth";
import {
  deleteSlab,
  DuplicateBlockError,
  findBlockConflict,
  saveSlab,
  setSlabStatus,
  SlabInputError,
  takeStaleUploads,
} from "@/lib/db";
import { deleteImages } from "@/lib/storage";
import type { ActionResult, SaveSlabInput } from "@/lib/types";

function friendly(e: unknown): string {
  if (e instanceof NotAllowedError || e instanceof DuplicateBlockError || e instanceof SlabInputError) return e.message;
  console.error(e);
  return "Something went wrong while saving. Please try again.";
}

/** Live duplicate warning while typing. */
export async function checkBlockAction(block: string, excludeId?: string) {
  await requireUser();
  return findBlockConflict(block, excludeId);
}

export async function saveSlabAction(input: SaveSlabInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireEditor();
    const { id, removedPaths } = await saveSlab(input, me.id);
    await deleteImages(removedPaths);
    // Tidy up uploads from editors that were closed without saving.
    await deleteImages(await takeStaleUploads(new Date(Date.now() - 24 * 3600 * 1000)));
    revalidatePath("/");
    return { ok: true, data: { id } };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

/** Drops photos uploaded in an editor session whose save failed or was abandoned. */
export async function discardUploadsAction(ids: string[]) {
  await requireEditor();
  await deleteImages(await takeStaleUploads(new Date(), ids));
}

export async function setStatusAction(id: string, status: "available" | "sold"): Promise<ActionResult> {
  try {
    await requireEditor();
    await setSlabStatus(id, status);
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}

export async function deleteSlabAction(id: string): Promise<ActionResult> {
  try {
    await requireHardDelete();
    await deleteImages(await deleteSlab(id));
    revalidatePath("/");
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: friendly(e) };
  }
}
