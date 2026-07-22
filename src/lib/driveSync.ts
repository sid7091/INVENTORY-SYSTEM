import "server-only";
import { prisma } from "@/lib/prisma";
import { savePhoto } from "@/lib/storage";
import { attachPhoto } from "@/lib/photoAttach";
import { parsePhotoName } from "@/lib/utils";
import { buildBlockMatcherWithCandidates } from "@/lib/blockMatch";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/appSettings";
import {
  extractFolderId,
  listChildren,
  isDriveFolder,
  isDriveImage,
  downloadDriveFile,
  type DriveFileMeta,
} from "@/lib/drive";

export interface DriveSyncSummary {
  foldersScanned: number;
  photosImported: number;
  actionItemsCreated: number;
  actionItemsResolved: number;
  actionItemsDismissed: number;
  error?: string;
}

const MAX_PREVIEW_IMAGES = 12;

// Import every not-yet-imported image in a Drive folder into a specific
// block. Shared by the automatic sync (confident unique matches) and by
// staff manually assigning an ambiguous/unmatched Needs Actions entry to a
// block — both are "we now know which block this Drive folder is" moments.
export async function importDriveFolderPhotos(folderId: string, blockId: string): Promise<number> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY is not configured.");

  const files = (await listChildren(folderId, apiKey)).filter(isDriveImage);
  let imported = 0;
  for (const file of files) {
    const already = await prisma.driveImportedFile.findUnique({ where: { driveFileId: file.id } });
    if (already) continue;
    let bytes: Buffer;
    try {
      bytes = await downloadDriveFile(file.id, apiKey);
    } catch {
      continue;
    }
    const saved = await savePhoto(file.name, bytes);
    const photoId = await prisma.$transaction(async (tx) => {
      await attachPhoto(tx, blockId, null, saved);
      const photo = await tx.photo.findFirst({
        where: { blockId, filename: saved.filename },
        orderBy: { createdAt: "desc" },
      });
      return photo?.id ?? null;
    });
    await prisma.driveImportedFile.create({ data: { driveFileId: file.id, blockId, photoId } });
    imported++;
  }
  return imported;
}

// Runs one full pass: list the configured Drive folder's immediate
// subfolders (one per block), match each to a block by NUMBER ONLY (names
// are explicitly unreliable — staff rename blocks), import new photos for
// confident unique matches, and file a Needs Actions entry for anything
// unmatched or ambiguous. Safe to call repeatedly — already-imported Drive
// files are never re-imported (tracked via DriveImportedFile).
export async function runDriveSync(): Promise<DriveSyncSummary> {
  const summary: DriveSyncSummary = {
    foldersScanned: 0,
    photosImported: 0,
    actionItemsCreated: 0,
    actionItemsResolved: 0,
    actionItemsDismissed: 0,
  };

  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) {
    summary.error = "GOOGLE_DRIVE_API_KEY is not configured.";
    return summary;
  }

  const folderUrl = await getSetting(SETTING_KEYS.driveFolderUrl);
  if (!folderUrl) {
    summary.error = "No Google Drive folder link is configured yet.";
    return summary;
  }

  const rootFolderId = extractFolderId(folderUrl);
  if (!rootFolderId) {
    summary.error = "The configured Drive folder link doesn't look valid.";
    return summary;
  }

  let children: DriveFileMeta[];
  try {
    children = await listChildren(rootFolderId, apiKey);
  } catch (e) {
    summary.error = e instanceof Error ? e.message : "Failed to read the Drive folder.";
    return summary;
  }

  const subfolders = children.filter(isDriveFolder);
  summary.foldersScanned = subfolders.length;

  const match = await buildBlockMatcherWithCandidates();
  const seenFolderIds = new Set<string>();

  for (const folder of subfolders) {
    seenFolderIds.add(folder.id);
    const parsed = parsePhotoName(folder.name);
    const result = parsed ? match({ key: parsed.key, digits: parsed.digits }) : { blockId: null, candidateCount: 0 };

    const existingActionItem = await prisma.actionItem.findFirst({
      where: { driveFolderId: folder.id, status: "OPEN" },
    });

    if (result.blockId) {
      // Confident unique match — import any new photos in this folder.
      try {
        summary.photosImported += await importDriveFolderPhotos(folder.id, result.blockId);
      } catch {
        continue; // one bad folder shouldn't abort the whole sync
      }

      if (existingActionItem) {
        await prisma.actionItem.update({
          where: { id: existingActionItem.id },
          data: { status: "RESOLVED", resolvedBy: "system (auto-matched)", resolvedAt: new Date(), blockId: result.blockId },
        });
        summary.actionItemsResolved++;
      }
      continue;
    }

    // No confident match — file (or refresh) a Needs Actions entry with
    // preview images so staff can confirm/assign the right block.
    let files: DriveFileMeta[];
    try {
      files = (await listChildren(folder.id, apiKey)).filter(isDriveImage);
    } catch {
      files = [];
    }
    const images = files.slice(0, MAX_PREVIEW_IMAGES).map((f) => ({ fileId: f.id, name: f.name }));

    const type = !parsed ? "DRIVE_UNMATCHED" : result.candidateCount > 1 ? "DRIVE_AMBIGUOUS" : "DRIVE_UNMATCHED";
    const message = !parsed
      ? `The Drive folder "${folder.name}" doesn't look like it contains a block number. Confirm which block these ${files.length} photo(s) belong to.`
      : result.candidateCount > 1
        ? `The Drive folder "${folder.name}" matches more than one block number. Confirm which block these ${files.length} photo(s) belong to.`
        : `No block found matching the Drive folder "${folder.name}". Add this block, or confirm which existing block these ${files.length} photo(s) belong to.`;

    if (existingActionItem) {
      await prisma.actionItem.update({
        where: { id: existingActionItem.id },
        data: { type, message, driveFolderName: folder.name, images: JSON.stringify(images) },
      });
    } else {
      await prisma.actionItem.create({
        data: {
          type,
          message,
          driveFolderId: folder.id,
          driveFolderName: folder.name,
          images: JSON.stringify(images),
        },
      });
      summary.actionItemsCreated++;
    }
  }

  // A folder that's gone (renamed away / removed from Drive) shouldn't leave
  // a stale open action item behind.
  const staleOpen = await prisma.actionItem.findMany({
    where: { status: "OPEN", driveFolderId: { not: null } },
    select: { id: true, driveFolderId: true },
  });
  for (const item of staleOpen) {
    if (item.driveFolderId && !seenFolderIds.has(item.driveFolderId)) {
      await prisma.actionItem.update({
        where: { id: item.id },
        data: { status: "DISMISSED", resolvedBy: "system (folder no longer in Drive)", resolvedAt: new Date() },
      });
      summary.actionItemsDismissed++;
    }
  }

  await setSetting(SETTING_KEYS.driveLastSyncAt, new Date().toISOString());
  await setSetting(SETTING_KEYS.driveLastSyncSummary, JSON.stringify(summary));

  return summary;
}
