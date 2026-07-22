import { NextRequest, NextResponse } from "next/server";
import { runDriveSync } from "@/lib/driveSync";

// Called on a schedule by Vercel Cron (see vercel.json) — never by a staff
// browser session, so this is authenticated with a bearer secret instead of
// the normal cookie session (and is excluded from src/middleware.ts's auth
// gate the same way /api/auth is).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
  }

  const summary = await runDriveSync();
  return NextResponse.json({ ok: !summary.error, ...summary });
}
