"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDriveSyncProgress } from "@/app/actions/driveSettings";

const POLL_MS = 1500;

// Polls the server-side sync progress (written by runDriveSync as it walks
// the Drive tree) so staff can see what's actually happening — which
// reflects ANY sync in progress, not just one this browser tab triggered
// (including the nightly cron run).
export function DriveSyncStatusBar() {
  const router = useRouter();
  const [progress, setProgress] = useState<{ phase: string; current: string | null; processed: number; total: number } | null>(null);
  const wasRunning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const p = await getDriveSyncProgress();
      if (cancelled) return;
      if (p?.running) {
        wasRunning.current = true;
        setProgress({ phase: p.phase, current: p.current, processed: p.processed, total: p.total });
      } else {
        if (wasRunning.current) {
          wasRunning.current = false;
          router.refresh(); // a sync just finished — pull the fresh summary/results in
        }
        setProgress(null);
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!progress) return null;

  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : null;

  return (
    <div className="rounded-md border border-tan-200 bg-cream-100 px-3 py-2 text-sm text-brown-700">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{progress.phase}…</span>
        {pct != null && <span className="text-xs text-brown-500">{progress.processed}/{progress.total}</span>}
      </div>
      {progress.current && <div className="mt-1 truncate font-mono text-xs text-brown-500">Scanning: {progress.current}</div>}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
        <div
          className="h-full rounded-full bg-tan-400 transition-all"
          style={{ width: pct != null ? `${pct}%` : "30%" }}
        />
      </div>
    </div>
  );
}
