import { NextRequest, NextResponse } from "next/server";
import { NotAllowedError, requireEditor } from "@/lib/auth";
import { createUploadedImage } from "@/lib/db";
import { putImage } from "@/lib/storage";

// One photo per request (already converted to JPEG in the browser), so each
// request stays well under the hosting body limit. Returns the new image id;
// it is attached to a slab when the slab is saved.
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    await requireEditor();
  } catch (e) {
    const msg = e instanceof NotAllowedError ? e.message : "Please sign in again.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
  const form = await req.formData();
  const full = form.get("full");
  const thumb = form.get("thumb");
  const width = Number(form.get("width")) || 0;
  const height = Number(form.get("height")) || 0;
  if (!(full instanceof Blob) || !(thumb instanceof Blob)) {
    return NextResponse.json({ error: "The photo didn't arrive. Please try again." }, { status: 400 });
  }
  if (full.size > MAX_BYTES || thumb.size > MAX_BYTES) {
    return NextResponse.json({ error: "That photo is too large. Please try a smaller one." }, { status: 413 });
  }
  const [path, thumbPath] = await Promise.all([
    putImage(Buffer.from(await full.arrayBuffer())),
    putImage(Buffer.from(await thumb.arrayBuffer())),
  ]);
  const img = await createUploadedImage({ path, thumbPath, width, height });
  return NextResponse.json({ id: img.id });
}
