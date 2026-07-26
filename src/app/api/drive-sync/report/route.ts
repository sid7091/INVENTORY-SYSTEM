import { NextResponse } from "next/server";
import { checkPermission, PERMISSION_DENIED_MSG } from "@/lib/auth";
import { runDriveDiagnostics, diagnosticsToCsv } from "@/lib/driveDiagnostics";
import { brandSlug } from "@/lib/brand";

// Scanning a large tree takes a while — same allowance as the sync itself.
export const maxDuration = 300;

// Downloads the diagnostic report as CSV (opens in Excel).
export async function GET() {
  const user = await checkPermission("drivesync.run");
  if (!user) return NextResponse.json({ error: PERMISSION_DENIED_MSG }, { status: 403 });

  const csv = diagnosticsToCsv(await runDriveDiagnostics());
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${brandSlug()}-drive-sync-report-${date}.csv"`,
    },
  });
}
