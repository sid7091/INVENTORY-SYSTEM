import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { slugifyFilename } from "./utils";

// Photo storage abstraction.
//
// Locally (and self-hosted) photos are written under public/uploads. On Vercel
// the filesystem is read-only + ephemeral, so when BLOB_READ_WRITE_TOKEN is set
// we transparently use Vercel Blob instead. The rest of the app only sees URLs.
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const STAGING_DIR = path.join(UPLOAD_DIR, "_staging");

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

// Deterministic-ish unique suffix without Math.random (kept simple & unique).
let counter = 0;
function uniquePrefix(): string {
  counter = (counter + 1) % 1_000_000;
  return `${process.hrtime.bigint().toString(36)}-${counter.toString(36)}`;
}

// Save a committed photo. Returns the public URL path.
export async function savePhoto(filename: string, bytes: Buffer): Promise<{ url: string; filename: string }> {
  const key = `${uniquePrefix()}-${slugifyFilename(filename)}`;
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`photos/${key}`, bytes, { access: "public" });
    return { url, filename };
  }
  await ensureDir(UPLOAD_DIR);
  await fs.writeFile(path.join(UPLOAD_DIR, key), bytes);
  return { url: `/uploads/${key}`, filename };
}

// Stage a photo for the review room (not yet visible in inventory).
export async function stagePhoto(filename: string, bytes: Buffer): Promise<{ tempUrl: string }> {
  const key = `${uniquePrefix()}-${slugifyFilename(filename)}`;
  if (USE_BLOB) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`staging/${key}`, bytes, { access: "public" });
    return { tempUrl: url };
  }
  await ensureDir(STAGING_DIR);
  await fs.writeFile(path.join(STAGING_DIR, key), bytes);
  return { tempUrl: `/uploads/_staging/${key}` };
}

// Promote a staged file into permanent storage.
export async function commitStaged(tempUrl: string): Promise<string> {
  if (USE_BLOB) {
    // Blob-staged files are already permanent public URLs; keep as-is.
    return tempUrl;
  }
  const rel = tempUrl.replace(/^\/uploads\//, "");
  const src = path.join(UPLOAD_DIR, rel);
  const base = path.basename(src);
  const dest = path.join(UPLOAD_DIR, base);
  await fs.rename(src, dest).catch(async () => {
    // Cross-device or already-moved fallback: copy.
    await fs.copyFile(src, dest);
    await fs.unlink(src).catch(() => {});
  });
  return `/uploads/${base}`;
}

export async function deleteStaged(tempUrl: string): Promise<void> {
  if (USE_BLOB) {
    if (/^https?:\/\//.test(tempUrl)) {
      const { del } = await import("@vercel/blob");
      await del(tempUrl).catch(() => {});
    }
    return;
  }
  const rel = tempUrl.replace(/^\/uploads\//, "");
  await fs.unlink(path.join(UPLOAD_DIR, rel)).catch(() => {});
}

export interface StorageCheck {
  ok: boolean;
  mode: "blob" | "local";
  detail: string;
}

// Prove photo storage actually works, by writing a tiny file and deleting it.
// This is the single most common production breakage: on a serverless host the
// project filesystem is READ-ONLY, so without BLOB_READ_WRITE_TOKEN every
// photo save fails. Surfacing it explicitly beats "photos just don't appear".
export async function checkStorageWritable(): Promise<StorageCheck> {
  const mode: "blob" | "local" = USE_BLOB ? "blob" : "local";
  try {
    const probe = Buffer.from("eagle-storage-probe");
    const { url } = await savePhoto("_storage-probe.txt", probe);
    // Clean the probe up; failing to delete it isn't a storage failure.
    await deleteStaged(url).catch(() => {});
    if (!USE_BLOB) {
      const rel = url.replace(/^\/uploads\//, "");
      await fs.unlink(path.join(UPLOAD_DIR, rel)).catch(() => {});
    }
    return {
      ok: true,
      mode,
      detail: USE_BLOB
        ? "Vercel Blob is connected — photos can be saved."
        : "Writing to the local uploads folder — photos can be saved.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      mode,
      detail: USE_BLOB
        ? `Vercel Blob rejected a test write: ${msg}`
        : `Cannot write photos to disk: ${msg}. On Vercel the project filesystem is read-only — create a Blob store (Storage → Create → Blob) so BLOB_READ_WRITE_TOKEN is set, then redeploy.`,
    };
  }
}

// Remove every stored photo (committed + staged). Used by the admin "clear all
// data" reset. Best-effort — DB rows are the source of truth either way.
export async function clearAllPhotoFiles(): Promise<void> {
  if (USE_BLOB) {
    const { list, del } = await import("@vercel/blob");
    for (const prefix of ["photos/", "staging/"]) {
      let cursor: string | undefined;
      do {
        const res = await list({ prefix, cursor, limit: 500 });
        if (res.blobs.length) await del(res.blobs.map((b) => b.url));
        cursor = res.cursor;
      } while (cursor);
    }
    return;
  }
  // Remove only photo files, not the directory itself — .gitkeep must survive.
  for (const dir of [UPLOAD_DIR, STAGING_DIR]) {
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    for (const entry of entries) {
      if (entry === ".gitkeep" || entry === "_staging") continue;
      await fs.rm(path.join(dir, entry), { recursive: true, force: true }).catch(() => {});
    }
  }
}
