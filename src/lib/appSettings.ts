import "server-only";
import { prisma } from "./prisma";

// Keys used in the AppSetting key/value store.
export const SETTING_KEYS = {
  driveFolderUrl: "driveFolderUrl",
  driveLastSyncAt: "driveLastSyncAt",
  driveLastSyncSummary: "driveLastSyncSummary",
} as const;

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
