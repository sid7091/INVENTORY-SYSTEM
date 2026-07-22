"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/appSettings";
import { extractFolderId } from "@/lib/drive";
import { runDriveSync, type DriveSyncSummary } from "@/lib/driveSync";
import type { ActionResult } from "./blocks";

export interface DriveSettingsView {
  folderUrl: string | null;
  apiKeyConfigured: boolean;
  lastSyncAt: string | null;
  lastSyncSummary: DriveSyncSummary | null;
}

export async function getDriveSettings(): Promise<DriveSettingsView> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    return { folderUrl: null, apiKeyConfigured: false, lastSyncAt: null, lastSyncSummary: null };
  }
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
  };
}

export async function saveDriveFolderUrl(url: string): Promise<ActionResult> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only admins can change the Drive folder link." };

  const trimmed = url.trim();
  if (!trimmed) {
    await setSetting(SETTING_KEYS.driveFolderUrl, "");
    revalidatePath("/admin");
    return { ok: true };
  }
  if (!extractFolderId(trimmed)) {
    return { ok: false, error: "That doesn't look like a valid Google Drive folder link." };
  }
  await setSetting(SETTING_KEYS.driveFolderUrl, trimmed);
  revalidatePath("/admin");
  return { ok: true };
}

export async function triggerDriveSyncNow(): Promise<{ ok: true; summary: DriveSyncSummary } | { ok: false; error: string }> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { ok: false, error: "Only admins can run a sync." };

  const summary = await runDriveSync();
  revalidatePath("/admin");
  revalidatePath("/needs-actions");
  if (summary.error) return { ok: false, error: summary.error };
  return { ok: true, summary };
}
