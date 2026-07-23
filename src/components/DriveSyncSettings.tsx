"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveDriveFolderUrl, triggerDriveSyncNow, type DriveSettingsView } from "@/app/actions/driveSettings";
import { useToast } from "@/components/ui/Toast";

export function DriveSyncSettings({ settings }: { settings: DriveSettingsView }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState(settings.folderUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function save() {
    setSaving(true);
    const res = await saveDriveFolderUrl(url);
    setSaving(false);
    if (res.ok) {
      toast("Drive folder link saved.", "success");
      router.refresh();
    } else {
      toast(res.error, "error");
    }
  }

  async function syncNow() {
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

  const summary = settings.lastSyncSummary;

  return (
    <section className="card p-5">
      <h2 className="mb-1 font-serif text-base font-bold text-brown-800">Google Drive photo sync</h2>
      <p className="mb-4 text-sm text-brown-500">
        Paste the shared Drive folder link. Any nested structure works (e.g. colour folders containing block
        folders) — a folder whose own name has a block number gets all its photos; loose photos with a block
        number in the file name (not organised into a block folder) get matched individually too. Runs
        automatically every night, and every run re-checks folders that didn&apos;t match yet — so a block added
        after its photos were already in Drive gets linked up automatically next sync. Anything still unclear
        shows up in Needs Actions with previews so staff can confirm.
      </p>

      {!settings.apiKeyConfigured && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          GOOGLE_DRIVE_API_KEY is not set — add it in your environment variables before syncing will work.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-0 flex-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/..."
          disabled={saving}
        />
        <button className="btn-secondary text-sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save link"}
        </button>
        <button className="btn-primary text-sm" onClick={syncNow} disabled={syncing || !settings.folderUrl}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {settings.lastSyncAt && (
        <p className="mt-3 text-xs text-brown-400">
          Last synced {new Date(settings.lastSyncAt).toLocaleString()}
          {summary && !summary.error && (
            <>
              {" "}— {summary.foldersScanned} folder(s) scanned, {summary.photosImported} photo(s) imported, {summary.actionItemsCreated} new item(s), {summary.actionItemsResolved} resolved
              {summary.skippedEmptyFolders.length > 0 && <>, {summary.skippedEmptyFolders.length} empty folder(s) skipped</>}
            </>
          )}
          {summary?.error && <span className="text-status-damaged"> — {summary.error}</span>}
          {summary?.capped && (
            <span className="text-amber-700"> — stopped early after scanning a very large number of folders; run Sync now again to continue</span>
          )}
        </p>
      )}
    </section>
  );
}
