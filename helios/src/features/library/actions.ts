"use server";

import { requireUser } from "@/lib/auth";
import { clearSelection, getSlabsForPdf, setSelected } from "@/lib/db";
import type { SlabDetail } from "@/lib/types";

export async function toggleSelectionAction(slabId: string, selected: boolean) {
  const me = await requireUser();
  await setSelected(me.id, slabId, selected);
}

export async function clearSelectionAction() {
  const me = await requireUser();
  await clearSelection(me.id);
}

/** Full details of the ticked slabs, in library order, for the PDF. */
export async function pdfSlabsAction(ids: string[]): Promise<SlabDetail[]> {
  const me = await requireUser();
  return getSlabsForPdf(ids.slice(0, 200), me.role);
}
