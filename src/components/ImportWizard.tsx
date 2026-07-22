"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { formatThickness } from "@/lib/constants";

interface PreviewRow {
  rowIndex: number; blockNo: string; colour: string; exporter: string | null;
  thicknessMm: number | null; pcs: number | null; totalSft: number | null;
  category: string; action: string;
}
interface Preview {
  summary: { totalRows: number; valid: number; create: number; update: number; restore: number; errorCount: number; warningCount: number };
  rows: PreviewRow[];
  errors: { rowIndex: number; field: string; message: string }[];
  warnings: { rowIndex: number; field: string; message: string }[];
}

const ACTION_BADGE: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-800",
  update: "bg-yellow-100 text-yellow-800",
  "restore-update": "bg-blue-100 text-blue-800",
};

export function ImportWizard() {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  async function runPreview(f: File) {
    setFile(f);
    setPreview(null);
    setLoading(true);
    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Preview failed.", "error"); setLoading(false); return; }
    setPreview(data);
    setLoading(false);
  }

  async function commit() {
    if (!file) return;
    setCommitting(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    const data = await res.json();
    if (!res.ok) { toast(data.error || "Import failed.", "error"); setCommitting(false); return; }
    toast(`Import committed: ${data.created} created, ${data.updated} updated.`, "success");
    setFile(null); setPreview(null);
    router.refresh();
    setCommitting(false);
  }

  const hasErrors = (preview?.summary.errorCount ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) runPreview(e.dataTransfer.files[0]); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-tan-300 bg-cream-50 py-10 text-center hover:bg-cream-100"
      >
        <div className="text-3xl text-tan-400">⤓</div>
        <p className="mt-2 text-sm font-medium text-brown-600">{loading ? "Parsing…" : file ? file.name : "Drop the Ready-to-Dispatch Excel or CSV file, or click to select"}</p>
        <p className="text-xs text-brown-400">Pre-mapped to: BLOCK NO · QUARRY NO · COLOUR · EXPORTER · QUARRY · WEIGHT · L×H · PCS · END PCS · SFT · THICKNESS · CATEGORY</p>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && runPreview(e.target.files[0])} />
      </div>

      {preview && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: "Valid rows", value: preview.summary.valid, accent: "text-brown-800" },
              { label: "New", value: preview.summary.create, accent: "text-status-instock" },
              { label: "Updates", value: preview.summary.update, accent: "text-status-reserved" },
              { label: "Restores", value: preview.summary.restore, accent: "text-blue-600" },
              { label: "Errors", value: preview.summary.errorCount, accent: hasErrors ? "text-status-damaged" : "text-brown-400" },
            ].map((s) => (
              <div key={s.label} className="card p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-brown-400">{s.label}</div>
                <div className={`text-xl font-bold ${s.accent}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {hasErrors && (
            <div className="card border-status-damaged/40 bg-red-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-red-800">Validation errors — import is blocked until these are fixed</h3>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-red-700">
                {preview.errors.map((e, idx) => <li key={idx}>• {e.message}</li>)}
              </ul>
            </div>
          )}

          {preview.warnings.length > 0 && (
            <div className="card border-amber-300 bg-amber-50 p-4">
              <h3 className="mb-2 text-sm font-bold text-amber-800">Warnings — import can still proceed ({preview.warnings.length})</h3>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-amber-800">
                {preview.warnings.map((w, idx) => <li key={idx}>• {w.message}</li>)}
              </ul>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="min-w-full divide-y divide-cream-200">
              <thead className="bg-cream-100"><tr>
                <th className="th">#</th><th className="th">Block No</th><th className="th">Colour</th><th className="th">Exporter</th>
                <th className="th">Thk</th><th className="th">Slabs</th><th className="th">SFT</th><th className="th">Action</th>
              </tr></thead>
              <tbody className="divide-y divide-cream-100">
                {preview.rows.slice(0, 200).map((r) => (
                  <tr key={r.rowIndex}>
                    <td className="td text-brown-400">{r.rowIndex}</td>
                    <td className="td font-mono font-semibold">{r.blockNo}</td>
                    <td className="td">{r.colour}</td>
                    <td className="td text-brown-500">{r.exporter ?? "—"}</td>
                    <td className="td">{formatThickness(r.thicknessMm)}</td>
                    <td className="td">{r.pcs ?? "—"}</td>
                    <td className="td">{r.totalSft ?? "—"}</td>
                    <td className="td"><span className={`badge ${ACTION_BADGE[r.action]}`}>{r.action}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 && <p className="px-3 py-2 text-xs text-brown-400">Showing first 200 of {preview.rows.length} rows.</p>}
          </div>

          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={commit} disabled={committing || hasErrors || preview.summary.valid === 0}>
              {committing ? "Committing…" : `Commit import (${preview.summary.valid} rows)`}
            </button>
            <button className="btn-secondary" onClick={() => { setFile(null); setPreview(null); }}>Cancel</button>
            <span className="text-xs text-brown-400">All-or-nothing: the entire import runs in one transaction and rolls back on any failure.</span>
          </div>
        </>
      )}
    </div>
  );
}
