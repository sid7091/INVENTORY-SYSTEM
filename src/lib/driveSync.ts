import "server-only";
import { prisma } from "@/lib/prisma";
import { savePhoto } from "@/lib/storage";
import { attachPhoto } from "@/lib/photoAttach";
import { parsePhotoName } from "@/lib/utils";
import { buildBlockMatcherWithCandidates } from "@/lib/blockMatch";
import { getSetting, setSetting, SETTING_KEYS } from "@/lib/appSettings";
import { extractFolderId, listChildren, isDriveFolder, isDriveImage, downloadDriveFile, type DriveFileMeta } from "@/lib/drive";

export interface DriveSyncSummary {
  foldersScanned: number;
  photosImported: number;
  actionItemsCreated: number;
  actionItemsResolved: number;
  actionItemsDismissed: number;
  skippedEmptyFolders: string[];
  error?: string;
  capped?: boolean;
}

export interface DriveSyncProgress {
  running: boolean;
  phase: string;
  current: string | null;
  processed: number;
  total: number;
  startedAt: string;
}

const PROGRESS_WRITE_INTERVAL_MS = 1000;
let lastProgressWrite = 0;

// Best-effort, throttled progress write — a status bar polls this, so it's
// fine (and important, for a tree with thousands of folders) to skip most
// intermediate updates rather than hit the DB on every single folder.
async function writeProgress(update: DriveSyncProgress, force = false): Promise<void> {
  const now = Date.now();
  if (!force && update.running && now - lastProgressWrite < PROGRESS_WRITE_INTERVAL_MS) return;
  lastProgressWrite = now;
  await setSetting(SETTING_KEYS.driveSyncProgress, JSON.stringify(update)).catch(() => {});
}

const MAX_PREVIEW_IMAGES = 12;
// Safety backstop against an enormous or mis-shared Drive tree — each visited
// folder costs one API call, so this bounds a single sync's worst case.
const MAX_FOLDERS_VISITED = 3000;

interface DriveImageEntry {
  file: DriveFileMeta;
  parentFolder: DriveFileMeta;
}

// Walk the whole tree under the shared root, arbitrarily deep (the real
// layout is root -> colour folder -> block folder -> images, but no depth is
// assumed). Every image found is recorded with its immediate parent folder.
// Also tracks, per root-level folder (colour grouping), whether its entire
// subtree turned up any images at all — an empty one (e.g. a colour with
// nothing uploaded yet) is reported back so it's visible, not silently
// dropped.
async function collectAllImages(
  rootFolderId: string,
  apiKey: string,
  startedAt: string,
): Promise<{ images: DriveImageEntry[]; foldersVisited: number; capped: boolean; emptyTopLevelFolders: string[] }> {
  const images: DriveImageEntry[] = [];
  const rootChildren = await listChildren(rootFolderId, apiKey);
  const topLevelFolders = rootChildren.filter(isDriveFolder);
  const topLevelHasImages = new Map<string, boolean>(topLevelFolders.map((f) => [f.id, false]));

  const queue: { folder: DriveFileMeta; topLevelId: string }[] = topLevelFolders.map((f) => ({ folder: f, topLevelId: f.id }));
  let visited = 0;
  let capped = false;

  while (queue.length) {
    if (visited >= MAX_FOLDERS_VISITED) {
      capped = true;
      break;
    }
    const { folder, topLevelId } = queue.shift()!;
    visited++;
    await writeProgress({
      running: true,
      phase: "Scanning Drive folders",
      current: folder.name,
      processed: visited,
      total: visited + queue.length,
      startedAt,
    });
    let children: DriveFileMeta[];
    try {
      children = await listChildren(folder.id, apiKey);
    } catch {
      continue; // one unreadable folder shouldn't abort the whole walk
    }
    const foundImages = children.filter(isDriveImage);
    if (foundImages.length > 0) {
      topLevelHasImages.set(topLevelId, true);
      for (const file of foundImages) images.push({ file, parentFolder: folder });
    }
    for (const sf of children.filter(isDriveFolder)) {
      queue.push({ folder: sf, topLevelId });
    }
  }

  const emptyTopLevelFolders = topLevelFolders.filter((f) => !topLevelHasImages.get(f.id)).map((f) => f.name);
  return { images, foldersVisited: visited, capped, emptyTopLevelFolders };
}

// Import a specific, already-identified set of Drive files into a block.
// Skips any file already imported (tracked via DriveImportedFile), so it's
// always safe to call again with an overlapping file list.
async function importDriveFiles(files: DriveFileMeta[], blockId: string, apiKey: string): Promise<number> {
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

// Import every not-yet-imported image directly inside a Drive folder into a
// specific block. Used when staff manually assigns a Needs Actions entry to
// a block — safe to call even though some of the folder's images may
// already have been auto-imported elsewhere (DriveImportedFile dedupes).
export async function importDriveFolderPhotos(folderId: string, blockId: string): Promise<number> {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_DRIVE_API_KEY is not configured.");
  const files = (await listChildren(folderId, apiKey)).filter(isDriveImage);
  return importDriveFiles(files, blockId, apiKey);
}

// Runs one full pass over the configured Drive folder. Two-tier matching per
// folder that directly contains images:
//   1. Try the FOLDER's own name against a block number (the common "one
//      subfolder per block" layout) — if unique, every image in it goes to
//      that block.
//   2. If the folder itself doesn't resolve (e.g. it's a colour folder with
//      loose images dropped straight in it, no per-block subfolders), match
//      each image individually by its own FILE name instead — the same
//      matcher used for the Photo Room's bulk upload.
// Whatever's left over after both tiers becomes one Needs Actions entry per
// folder. Folders with zero images anywhere in their subtree are reported
// as skipped, never turned into an action item. Safe to call repeatedly —
// already-imported Drive files are never re-imported.
export async function runDriveSync(): Promise<DriveSyncSummary> {
  const summary: DriveSyncSummary = {
    foldersScanned: 0,
    photosImported: 0,
    actionItemsCreated: 0,
    actionItemsResolved: 0,
    actionItemsDismissed: 0,
    skippedEmptyFolders: [],
  };
  const startedAt = new Date().toISOString();

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

  try {
    await writeProgress({ running: true, phase: "Starting", current: null, processed: 0, total: 0, startedAt }, true);

    let walk: Awaited<ReturnType<typeof collectAllImages>>;
    try {
      walk = await collectAllImages(rootFolderId, apiKey, startedAt);
    } catch (e) {
      summary.error = e instanceof Error ? e.message : "Failed to read the Drive folder.";
      return summary;
    }

    if (walk.capped) summary.capped = true;
    summary.skippedEmptyFolders = walk.emptyTopLevelFolders;

    const byFolder = new Map<string, DriveImageEntry[]>();
    for (const entry of walk.images) {
      const list = byFolder.get(entry.parentFolder.id) ?? [];
      list.push(entry);
      byFolder.set(entry.parentFolder.id, list);
    }
    summary.foldersScanned = byFolder.size;

    const match = await buildBlockMatcherWithCandidates();
    const seenFolderIds = new Set<string>();

    let matchIndex = 0;
    for (const [folderId, entries] of byFolder) {
      matchIndex++;
      seenFolderIds.add(folderId);
      const folder = entries[0].parentFolder;
      const files = entries.map((e) => e.file);
      await writeProgress({
        running: true,
        phase: "Matching photos to blocks",
        current: folder.name,
        processed: matchIndex,
        total: byFolder.size,
        startedAt,
      });

      const existingActionItem = await prisma.actionItem.findFirst({
        where: { driveFolderId: folderId, status: "OPEN" },
      });

      // Tier 1: the folder's own name resolves to one block.
      const parsedFolder = parsePhotoName(folder.name);
      const folderMatch = parsedFolder
        ? match({ key: parsedFolder.key, digits: parsedFolder.digits })
        : { blockId: null, candidateCount: 0 };

      if (folderMatch.blockId) {
        try {
          summary.photosImported += await importDriveFiles(files, folderMatch.blockId, apiKey);
        } catch {
          continue; // one bad folder shouldn't abort the whole sync
        }
        if (existingActionItem) {
          await prisma.actionItem.update({
            where: { id: existingActionItem.id },
            data: { status: "RESOLVED", resolvedBy: "system (auto-matched)", resolvedAt: new Date(), blockId: folderMatch.blockId },
          });
          summary.actionItemsResolved++;
        }
        continue;
      }

      // Tier 2: fall back to matching each image individually by file name.
      const unresolved: DriveFileMeta[] = [];
      for (const file of files) {
        const parsedFile = parsePhotoName(file.name);
        const fileMatch = parsedFile
          ? match({ key: parsedFile.key, digits: parsedFile.digits })
          : { blockId: null, candidateCount: 0 };
        if (fileMatch.blockId) {
          try {
            summary.photosImported += await importDriveFiles([file], fileMatch.blockId, apiKey);
          } catch {
            unresolved.push(file);
          }
        } else {
          unresolved.push(file);
        }
      }

      if (unresolved.length === 0) {
        if (existingActionItem) {
          await prisma.actionItem.update({
            where: { id: existingActionItem.id },
            data: { status: "RESOLVED", resolvedBy: "system (auto-matched by file name)", resolvedAt: new Date() },
          });
          summary.actionItemsResolved++;
        }
        continue;
      }

      const images = unresolved.slice(0, MAX_PREVIEW_IMAGES).map((f) => ({ fileId: f.id, name: f.name }));
      const allUnresolved = unresolved.length === files.length;
      const type = !parsedFolder ? "DRIVE_UNMATCHED" : folderMatch.candidateCount > 1 ? "DRIVE_AMBIGUOUS" : "DRIVE_UNMATCHED";
      const message = allUnresolved
        ? !parsedFolder
          ? `The Drive folder "${folder.name}" doesn't look like it contains a block number, and none of its ${files.length} photo(s) have one in their file name either. Confirm which block these belong to.`
          : folderMatch.candidateCount > 1
            ? `The Drive folder "${folder.name}" matches more than one block number, and none of its ${files.length} photo(s) resolved individually either. Confirm which block these belong to.`
            : `No block found matching the Drive folder "${folder.name}", and none of its ${files.length} photo(s) resolved individually either. Add this block, or confirm which existing block these belong to.`
        : `${unresolved.length} of ${files.length} photo(s) in the Drive folder "${folder.name}" couldn't be matched to a block automatically (the rest were imported). Confirm which block these belong to.`;

      if (existingActionItem) {
        await prisma.actionItem.update({
          where: { id: existingActionItem.id },
          data: { type, message, driveFolderName: folder.name, images: JSON.stringify(images) },
        });
      } else {
        await prisma.actionItem.create({
          data: { type, message, driveFolderId: folderId, driveFolderName: folder.name, images: JSON.stringify(images) },
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
  } finally {
    await writeProgress(
      { running: false, phase: "Idle", current: null, processed: 0, total: 0, startedAt },
      true,
    );
  }
}
