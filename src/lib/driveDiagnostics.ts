import "server-only";
import { prisma } from "@/lib/prisma";
import { parsePhotoName } from "@/lib/utils";
import { buildBlockMatcherWithCandidates, normKey } from "@/lib/blockMatch";
import { getSetting, SETTING_KEYS } from "@/lib/appSettings";
import { checkStorageWritable } from "@/lib/storage";
import { extractFolderId, listChildren, isDriveFolder, isDriveImage, type DriveFileMeta } from "@/lib/drive";

// Read-only "why didn't this work" report. Touches nothing: no downloads, no
// photo saves, no ActionItem writes. Answers, per Drive folder, exactly what
// the sync would do and — when it wouldn't match — why not.

export interface DiagnosticRow {
  folder: string;
  photoCount: number;
  parsedFrom: "folder name" | "file names" | "nothing";
  parsedKey: string;
  outcome: "would import" | "already imported" | "no match" | "several matches" | "no block number found";
  matchedBlock: string;
  reason: string;
}

export interface DriveDiagnostics {
  ranAt: string;
  checks: { label: string; ok: boolean; detail: string }[];
  rows: DiagnosticRow[];
  totals: {
    foldersWithPhotos: number;
    photosTotal: number;
    wouldImport: number;
    alreadyImported: number;
    unmatched: number;
    emptyFolders: number;
  };
  emptyFolders: string[];
  fatal?: string;
}

const MAX_FOLDERS_VISITED = 3000;

export async function runDriveDiagnostics(): Promise<DriveDiagnostics> {
  const ranAt = new Date().toISOString();
  const checks: DriveDiagnostics["checks"] = [];
  const rows: DiagnosticRow[] = [];
  const emptyFolders: string[] = [];

  const blank = (fatal: string): DriveDiagnostics => ({
    ranAt,
    checks,
    rows,
    emptyFolders,
    totals: { foldersWithPhotos: 0, photosTotal: 0, wouldImport: 0, alreadyImported: 0, unmatched: 0, emptyFolders: 0 },
    fatal,
  });

  // --- Configuration checks -------------------------------------------------
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  checks.push({
    label: "Google Drive API key",
    ok: !!apiKey,
    detail: apiKey ? "GOOGLE_DRIVE_API_KEY is set." : "GOOGLE_DRIVE_API_KEY is missing from the environment variables.",
  });

  const folderUrl = await getSetting(SETTING_KEYS.driveFolderUrl);
  const rootFolderId = folderUrl ? extractFolderId(folderUrl) : null;
  checks.push({
    label: "Drive folder link",
    ok: !!rootFolderId,
    detail: rootFolderId ? `Reading folder ${rootFolderId}.` : "No valid Drive folder link is saved on this page.",
  });

  // The big one: can we actually save a photo at all?
  const storage = await checkStorageWritable();
  checks.push({ label: `Photo storage (${storage.mode})`, ok: storage.ok, detail: storage.detail });

  const blockCount = await prisma.block.count({ where: { deletedAt: null } });
  checks.push({
    label: "Blocks in inventory",
    ok: blockCount > 0,
    detail: blockCount > 0
      ? `${blockCount} block(s) available to match against.`
      : "There are no blocks yet — import your spreadsheet first, or nothing can match.",
  });

  if (!apiKey) return blank("Add GOOGLE_DRIVE_API_KEY, then run this test again.");
  if (!rootFolderId) return blank("Save a valid Drive folder link, then run this test again.");

  // --- Walk the tree (read-only) --------------------------------------------
  let rootChildren: DriveFileMeta[];
  try {
    rootChildren = await listChildren(rootFolderId, apiKey);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    checks.push({ label: "Drive folder reachable", ok: false, detail: msg });
    return blank(`Could not read the Drive folder: ${msg}`);
  }
  checks.push({ label: "Drive folder reachable", ok: true, detail: `${rootChildren.length} item(s) at the top level.` });

  const topLevel = rootChildren.filter(isDriveFolder);
  const topLevelHasImages = new Map<string, boolean>(topLevel.map((f) => [f.id, false]));
  const queue: { folder: DriveFileMeta; topId: string }[] = topLevel.map((f) => ({ folder: f, topId: f.id }));
  const byFolder = new Map<string, { folder: DriveFileMeta; files: DriveFileMeta[] }>();
  let visited = 0;

  while (queue.length && visited < MAX_FOLDERS_VISITED) {
    const { folder, topId } = queue.shift()!;
    visited++;
    let children: DriveFileMeta[];
    try {
      children = await listChildren(folder.id, apiKey);
    } catch {
      continue;
    }
    const images = children.filter(isDriveImage);
    if (images.length > 0) {
      topLevelHasImages.set(topId, true);
      byFolder.set(folder.id, { folder, files: images });
    }
    for (const sf of children.filter(isDriveFolder)) queue.push({ folder: sf, topId });
  }
  for (const f of topLevel) if (!topLevelHasImages.get(f.id)) emptyFolders.push(f.name);

  // --- Explain every folder -------------------------------------------------
  const match = await buildBlockMatcherWithCandidates();
  const blockNoById = new Map(
    (await prisma.block.findMany({ where: { deletedAt: null }, select: { id: true, blockNo: true } })).map((b) => [b.id, b.blockNo]),
  );

  let wouldImport = 0;
  let alreadyImported = 0;
  let unmatched = 0;
  let photosTotal = 0;

  for (const { folder, files } of byFolder.values()) {
    photosTotal += files.length;
    const parsed = parsePhotoName(folder.name);
    const folderMatch = parsed ? match({ key: parsed.key, digits: parsed.digits }) : { blockId: null, candidateCount: 0 };

    const importedFlags = await Promise.all(
      files.map((f) => prisma.driveImportedFile.findUnique({ where: { driveFileId: f.id } }).then((r) => !!r)),
    );
    const newFiles = files.filter((_, i) => !importedFlags[i]);
    const doneCount = files.length - newFiles.length;

    // Tier 1 — folder name resolves to exactly one block.
    if (folderMatch.blockId) {
      const blockNo = blockNoById.get(folderMatch.blockId) ?? "?";
      if (newFiles.length === 0) {
        alreadyImported += files.length;
        rows.push({
          folder: folder.name, photoCount: files.length, parsedFrom: "folder name", parsedKey: parsed!.key,
          outcome: "already imported", matchedBlock: blockNo,
          reason: `All ${files.length} photo(s) were imported by an earlier sync.`,
        });
      } else {
        wouldImport += newFiles.length;
        alreadyImported += doneCount;
        rows.push({
          folder: folder.name, photoCount: files.length, parsedFrom: "folder name", parsedKey: parsed!.key,
          outcome: "would import", matchedBlock: blockNo,
          reason: storage.ok
            ? `${newFiles.length} new photo(s) ready to import.`
            : `${newFiles.length} new photo(s) BLOCKED by the photo storage problem above.`,
        });
      }
      continue;
    }

    // Tier 2 — match each file by its own name instead.
    const perFile = files.map((f, i) => {
      const p = parsePhotoName(f.name);
      const m = p ? match({ key: p.key, digits: p.digits }) : { blockId: null, candidateCount: 0 };
      return { file: f, blockId: m.blockId, already: importedFlags[i] };
    });
    const resolved = perFile.filter((r) => r.blockId);
    const leftovers = perFile.filter((r) => !r.blockId);

    if (resolved.length > 0) {
      const newResolved = resolved.filter((r) => !r.already);
      wouldImport += newResolved.length;
      alreadyImported += resolved.length - newResolved.length;
      const blocks = [...new Set(resolved.map((r) => blockNoById.get(r.blockId!) ?? "?"))];
      rows.push({
        folder: folder.name, photoCount: files.length, parsedFrom: "file names", parsedKey: blocks.join(" "),
        outcome: newResolved.length > 0 ? "would import" : "already imported",
        matchedBlock: blocks.join(" "),
        reason: `${resolved.length} of ${files.length} photo(s) matched by file name${leftovers.length ? `; ${leftovers.length} still unmatched` : ""}.`,
      });
    }

    if (leftovers.length > 0) {
      unmatched += leftovers.length;
      const digits = parsed?.digits ?? null;
      let outcome: DiagnosticRow["outcome"];
      let reason: string;
      if (!parsed) {
        outcome = "no block number found";
        reason = `Neither the folder name nor the ${leftovers.length} photo file name(s) contain a block number.`;
      } else if (folderMatch.candidateCount > 1) {
        outcome = "several matches";
        reason = `"${parsed.key}" matches ${folderMatch.candidateCount} different blocks — too ambiguous to pick automatically.`;
      } else {
        outcome = "no match";
        reason = digits
          ? `No block in inventory has the number ${digits} (looked for "${parsed.key}"). Either this block isn't imported yet, or the folder is named after something else.`
          : `Could not resolve "${parsed.key}" to a block.`;
      }
      rows.push({
        folder: folder.name, photoCount: leftovers.length, parsedFrom: parsed ? "folder name" : "nothing",
        parsedKey: parsed?.key ?? "", outcome, matchedBlock: "", reason,
      });
    }
  }

  rows.sort((a, b) => a.outcome.localeCompare(b.outcome) || a.folder.localeCompare(b.folder));

  // Which inventory blocks have NO photos and no Drive folder pointing at them?
  const withoutPhotos = await prisma.block.count({ where: { deletedAt: null, photos: { none: {} } } });
  checks.push({
    label: "Blocks still without photos",
    ok: withoutPhotos === 0,
    detail: withoutPhotos === 0 ? "Every block has at least one photo." : `${withoutPhotos} block(s) have no photos yet.`,
  });

  return {
    ranAt,
    checks,
    rows,
    emptyFolders,
    totals: {
      foldersWithPhotos: byFolder.size,
      photosTotal,
      wouldImport,
      alreadyImported,
      unmatched,
      emptyFolders: emptyFolders.length,
    },
  };
}

export function diagnosticsToCsv(d: DriveDiagnostics): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(`Eagle Stone — Drive sync diagnostic report`);
  lines.push(`Generated,${esc(d.ranAt)}`);
  lines.push("");
  lines.push("CHECKS");
  lines.push(["Check", "Status", "Detail"].join(","));
  for (const c of d.checks) lines.push([esc(c.label), c.ok ? "OK" : "PROBLEM", esc(c.detail)].join(","));
  lines.push("");
  lines.push("TOTALS");
  lines.push(`Folders with photos,${d.totals.foldersWithPhotos}`);
  lines.push(`Photos seen in Drive,${d.totals.photosTotal}`);
  lines.push(`Photos ready to import,${d.totals.wouldImport}`);
  lines.push(`Photos already imported,${d.totals.alreadyImported}`);
  lines.push(`Photos that cannot be matched,${d.totals.unmatched}`);
  lines.push(`Empty folders skipped,${d.totals.emptyFolders}`);
  if (d.fatal) {
    lines.push("");
    lines.push(`FATAL,${esc(d.fatal)}`);
  }
  lines.push("");
  lines.push("PER-FOLDER DETAIL");
  lines.push(["Drive folder", "Photos", "Block number read from", "Parsed as", "Result", "Matched block", "Why"].join(","));
  for (const r of d.rows) {
    lines.push([esc(r.folder), r.photoCount, esc(r.parsedFrom), esc(r.parsedKey), esc(r.outcome), esc(r.matchedBlock), esc(r.reason)].join(","));
  }
  if (d.emptyFolders.length) {
    lines.push("");
    lines.push("EMPTY FOLDERS (no photos anywhere inside — skipped, not an error)");
    for (const f of d.emptyFolders) lines.push(esc(f));
  }
  return lines.join("\n");
}
