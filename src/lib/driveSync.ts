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
  capped?: boolean;
}

const MAX_PREVIEW_IMAGES = 12;
// Safety backstop against an enormous or mis-shared Drive tree — each visited
// folder costs one API call, so this bounds a single sync's worst case.
const MAX_FOLDERS_VISITED = 3000;

interface DriveBlockFolder {
  folder: DriveFileMeta;
  images: DriveFileMeta[];
}

// Walk the whole tree under the shared root, arbitrarily deep — the real
// layout is root -> colour folder -> block folder -> images, but this makes
// no assumption about depth. A folder is treated as a "block folder" the
// moment it directly contains at least one image; folders that only contain
// more folders (colour groupings) are transparently descended into instead.
async function collectBlockFolders(
  rootFolderId: string,
  apiKey: string,
): Promise<{ folders: DriveBlockFolder[]; foldersVisited: number; capped: boolean }> {
  const result: DriveBlockFolder[] = [];
  const rootChildren = await listChildren(rootFolderId, apiKey);
  const queue: DriveFileMeta[] = rootChildren.filter(isDriveFolder);
  let visited = 0;
  let capped = false;

  while (queue.length) {
    if (visited >= MAX_FOLDERS_VISITED) {
      capped = true;
      break;
    }
    const folder = queue.shift()!;
    visited++;
    let children: DriveFileMeta[];
    try {
      children = await listChildren(folder.id, apiKey);
    } catch {
      continue; // one unreadable folder shouldn't abort the whole walk
    }
    const images = children.filter(isDriveImage);
    if (images.length > 0) {
      // This folder holds photos directly — it's a block folder. Don't
      // descend further: a stray subfolder inside it (e.g. an "extra
      // angles" album) shouldn't become its own, separately-unmatched entry.
      result.push({ folder, images });
    } else {
      queue.push(...children.filter(isDriveFolder));
    }
  }

  return { folders: result, foldersVisited: visited, capped };
}

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

// Runs one full pass: recursively walk every folder under the configured
// Drive root (colour folders, block folders, however many levels deep),
// treating any folder that directly holds images as one block's photo
// folder. Matches each to a block by NUMBER ONLY (names are explicitly
// unreliable — staff rename blocks), imports new photos for confident unique
// matches, and files a Needs Actions entry for anything unmatched or
// ambiguous. Safe to call repeatedly — already-imported Drive files are
// never re-imported (tracked via DriveImportedFile).
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

  let walk: { folders: DriveBlockFolder[]; foldersVisited: number; capped: boolean };
  try {
    walk = await collectBlockFolders(rootFolderId, apiKey);
  } catch (e) {
    summary.error = e instanceof Error ? e.message : "Failed to read the Drive folder.";
    return summary;
  }

  summary.foldersScanned = walk.folders.length;
  if (walk.capped) summary.capped = true;

  const match = await buildBlockMatcherWithCandidates();
  const seenFolderIds = new Set<string>();

  for (const { folder, images: allImages } of walk.folders) {
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
    const images = allImages.slice(0, MAX_PREVIEW_IMAGES).map((f) => ({ fileId: f.id, name: f.name }));

    const type = !parsed ? "DRIVE_UNMATCHED" : result.candidateCount > 1 ? "DRIVE_AMBIGUOUS" : "DRIVE_UNMATCHED";
    const message = !parsed
      ? `The Drive folder "${folder.name}" doesn't look like it contains a block number. Confirm which block these ${allImages.length} photo(s) belong to.`
      : result.candidateCount > 1
        ? `The Drive folder "${folder.name}" matches more than one block number. Confirm which block these ${allImages.length} photo(s) belong to.`
        : `No block found matching the Drive folder "${folder.name}". Add this block, or confirm which existing block these ${allImages.length} photo(s) belong to.`;

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
