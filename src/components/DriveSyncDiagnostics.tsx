"use client";
import { useState } from "react";
import { runDriveTest } from "@/app/actions/driveSettings";
import type { DriveDiagnostics } from "@/lib/driveDiagnostics";
import { useToast } from "@/components/ui/Toast";

const OUTCOME_STYLE: Record<string, string> = {
  "would import": "bg-emerald-100 text-emerald-900",
  "already imported": "bg-cream-200 text-brown-600",
  "no match": "bg-amber-100 text-amber-900",
  "several matches": "bg-orange-100 text-orange-900",
  "no block number found": "bg-red-100 text-red-900",
};

// "Test & diagnostics": runs a read-only scan and explains, folder by folder,
// exactly what the sync would do and why anything isn't matching. Nothing is
// written, so it's always safe to press.
export function DriveSyncDiagnostics() {
  const toast = useToast();
  const [report, setReport] = useState<DriveDiagnostics | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  async function runTest() {
    setBusy(true);
    const res = await runDriveTest();
    setBusy(false);
    if (res.ok) {
      setReport(res.report);
      const problems = res.report.checks.filter((c) => !c.ok).length;
      toast(problems > 0 ? `Test finished — ${problems} problem(s) found.` : "Test finished — everything checks out.", problems > 0 ? "error" : "success");
    } else {
      toast(res.error, "error");
    }
  }

  const rows = report ? (showAll ? report.rows : report.rows.slice(0, 25)) : [];

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-serif text-base font-bold text-brown-800">Test &amp; diagnostics</h2>
      <p className="mb-4 text-sm text-brown-500">
        Runs a read-only check — nothing is imported or changed. It reports whether the API key, folder link and
        photo storage are working, then explains folder by folder what the sync would do and why anything
        isn&apos;t matching. Download the CSV to open the full list in Excel.
      </p>

      <div className="flex flex-wrap gap-2">
        <button className="btn-primary text-sm" onClick={runTest} disabled={busy}>
          {busy ? "Testing…" : "Run test"}
        </button>
        <a href="/api/drive-sync/report" className="btn-secondary text-sm">Download CSV report</a>
      </div>

      {report && (
        <div className="mt-4 space-y-4">
          {report.fatal && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{report.fatal}</div>
          )}

          {/* Checks */}
          <ul className="space-y-1.5">
            {report.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2 text-sm">
                <span className={c.ok ? "text-emerald-600" : "text-status-damaged"}>{c.ok ? "✓" : "✕"}</span>
                <span>
                  <span className="font-medium text-brown-700">{c.label}</span>
                  <span className="block text-xs text-brown-500">{c.detail}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Folders", value: report.totals.foldersWithPhotos },
              { label: "Photos in Drive", value: report.totals.photosTotal },
              { label: "Ready to import", value: report.totals.wouldImport },
              { label: "Already imported", value: report.totals.alreadyImported },
              { label: "Can't match", value: report.totals.unmatched },
              { label: "Empty folders", value: report.totals.emptyFolders },
            ].map((s) => (
              <div key={s.label} className="rounded-md bg-cream-100 p-2 text-center">
                <div className="text-lg font-bold text-brown-800">{s.value}</div>
                <div className="text-[11px] text-brown-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Per-folder detail */}
          {report.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-cream-200 text-sm">
                <thead className="bg-cream-100"><tr>
                  <th className="th">Drive folder</th><th className="th">Photos</th><th className="th">Read as</th>
                  <th className="th">Result</th><th className="th">Block</th><th className="th">Why</th>
                </tr></thead>
                <tbody className="divide-y divide-cream-100">
                  {rows.map((r, i) => (
                    <tr key={`${r.folder}-${r.outcome}-${i}`}>
                      <td className="td font-mono text-xs">{r.folder}</td>
                      <td className="td">{r.photoCount}</td>
                      <td className="td font-mono text-xs">{r.parsedKey || "—"}</td>
                      <td className="td">
                        <span className={`badge ${OUTCOME_STYLE[r.outcome] ?? "bg-cream-200 text-brown-600"}`}>{r.outcome}</span>
                      </td>
                      <td className="td font-mono text-xs">{r.matchedBlock || "—"}</td>
                      <td className="td text-xs text-brown-500">{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {report.rows.length > 25 && (
                <button className="btn-ghost mt-2 text-xs" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? "Show fewer" : `Show all ${report.rows.length} rows`}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
