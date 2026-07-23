"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerDriveSyncNow } from "@/app/actions/driveSettings";
import { useToast } from "@/components/ui/Toast";

// Re-runs the Drive sync on demand. Every full sync re-evaluates every
// folder from scratch, so this is also how a folder that couldn't match
// earlier (its block wasn't in the system yet) gets picked up automatically
// once that block exists — no separate "resync pending" step needed.
export function SyncNowButton() {
  const router = useRouter();
  const toast = useToast();
  const [syncing, setSyncing] = useState(false);

  async function run() {
    setSyncing(true);
    const res = await triggerDriveSyncNow();
    setSyncing(false);
    if (res.ok) {
      const s = res.summary;
      toast(
        `Synced: ${s.foldersScanned} folder(s) scanned, ${s.photosImported} photo(s) imported, ${s.actionItemsCreated} new item(s), ${s.actionItemsResolved} resolved.`,
        "success",
      );
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  return (
    <button className="btn-secondary text-sm" onClick={run} disabled={syncing}>
      {syncing ? "Syncing…" : "Sync now"}
    </button>
  );
}
