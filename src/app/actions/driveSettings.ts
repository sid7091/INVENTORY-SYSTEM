"use server";
import { revalidatePath } from "next/cache";
import { requireUser, checkPermission, PERMISSION_DENIED_MSG } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/appSettings";
import { extractFolderId } from "@/lib/drive";
import { runDriveSync, type DriveSyncSummary, type DriveSyncProgress } from "@/lib/driveSync";
import type { ActionResult } from "./blocks";

export interface DriveSettingsView {
  folderUrl: string | null;
  apiKeyConfigured: boolean;
  lastSyncAt: string | null;
  lastSyncSummary: DriveSyncSummary | null;
  canEdit: boolean;
}

// Anyone signed in can VIEW the current settings (the folder link isn't a
// secret) — only saving a new link is admin-restricted.
export async function getDriveSettings(): Promise<DriveSettingsView> {
  const user = await requireUser();
  const [folderUrl, lastSyncAt, lastSyncSummaryRaw] = await Promise.all([
    getSetting(SETTING_KEYS.driveFolderUrl),
    getSetting(SETTING_KEYS.driveLastSyncAt),
    getSetting(SETTING_KEYS.driveLastSyncSummary),
  ]);
  return {
    folderUrl,
    apiKeyConfigured: !!process.env.GOOGLE_DRIVE_API_KEY,
    lastSyncAt,
    lastSyncSummary: lastSyncSummaryRaw ? JSON.parse(lastSyncSummaryRaw) : null,
    canEdit: await hasPermission(user.userId, "drivesync.configure"),
  };
}

// Polled by the status bar while a sync is running (started from anywhere —
// this browser, another staff member's, or the nightly cron).
export async function getDriveSyncProgress(): Promise<DriveSyncProgress | null> {
  await requireUser();
  const raw = await getSetting(SETTING_KEYS.driveSyncProgress);
  return raw ? JSON.parse(raw) : null;
}

export async function saveDriveFolderUrl(url: string): Promise<ActionResult> {
  const user = await checkPermission("drivesync.configure");
  if (!user) return { ok: false, error: PERMISSION_DENIED_MSG };

  const trimmed = url.trim();
  if (!trimmed) {
    await setSetting(SETTING_KEYS.driveFolderUrl, "");
    revalidatePath("/drive-sync");
    return { ok: true };
  }
  if (!extractFolderId(trimmed)) {
    return { ok: false, error: "That doesn't look like a valid Google Drive folder link." };
  }
  await setSetting(SETTING_KEYS.driveFolderUrl, trimmed);
  revalidatePath("/drive-sync");
  return { ok: true };
}

// Any signed-in staff member can trigger a sync (e.g. right after adding a
// block whose photos were already sitting in Drive) — only the folder link
// itself and who can edit it stay admin-restricted.
export async function triggerDriveSyncNow(): Promise<{ ok: true; summary: DriveSyncSummary } | { ok: false; error: string }> {
  if (!(await checkPermission("drivesync.run"))) return { ok: false, error: PERMISSION_DENIED_MSG };

  const summary = await runDriveSync();
  revalidatePath("/drive-sync");
  revalidatePath("/needs-actions");
  if (summary.error) return { ok: false, error: summary.error };
  return { ok: true, summary };
}
