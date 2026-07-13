import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { slugifyFilename } from "./utils";

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
  await ensureDir(UPLOAD_DIR);
  const safe = `${uniquePrefix()}-${slugifyFilename(filename)}`;
  await fs.writeFile(path.join(UPLOAD_DIR, safe), bytes);
  return { url: `/uploads/${safe}`, filename };
}

// Stage a photo for the review room (not yet visible in inventory).
export async function stagePhoto(filename: string, bytes: Buffer): Promise<{ tempUrl: string }> {
  await ensureDir(STAGING_DIR);
  const safe = `${uniquePrefix()}-${slugifyFilename(filename)}`;
  await fs.writeFile(path.join(STAGING_DIR, safe), bytes);
  return { tempUrl: `/uploads/_staging/${safe}` };
}

// Promote a staged file into the permanent uploads dir.
export async function commitStaged(tempUrl: string): Promise<string> {
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
  const rel = tempUrl.replace(/^\/uploads\//, "");
  await fs.unlink(path.join(UPLOAD_DIR, rel)).catch(() => {});
}
