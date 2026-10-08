import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getImageForViewer } from "@/lib/db";
import { getImage } from "@/lib/storage";

// Every photo goes through here, so only signed-in people can see them, and
// clients can't see photos of sold slabs. Photos never change once uploaded
// (edits create new images), so the browser may cache them for a long time.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const thumb = req.nextUrl.searchParams.get("size") === "thumb";
  const stored = await getImageForViewer(id, me.role, thumb);
  const bytes = stored ? await getImage(stored) : null;
  if (!bytes) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
