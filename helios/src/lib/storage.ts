import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

// Photo storage. On Vercel set BLOB_READ_WRITE_TOKEN and photos go to Vercel
// Blob; otherwise they are written to ./storage on disk (local dev / a VPS).
// Photos are never served directly: /api/img/[id] checks the login first.
// Not "server-only" so the import script can use it too.

const USE_BLOB = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const LOCAL_DIR = path.join(process.cwd(), "storage");

/** Saves bytes and returns the stored path (a Blob URL or a local file name). */
export async function putImage(bytes: Buffer, ext = "jpg"): Promise<string> {
  const key = `slabs/${randomUUID()}.${ext}`;
  if (USE_BLOB()) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(key, bytes, { access: "public", contentType: "image/jpeg" });
    return url;
  }
  await fs.mkdir(path.join(LOCAL_DIR, "slabs"), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, key), bytes);
  return key;
}

export async function getImage(stored: string): Promise<Buffer | null> {
  try {
    if (/^https?:\/\//.test(stored)) {
      const res = await fetch(stored);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    // Only ever read inside the storage folder.
    const file = path.join(LOCAL_DIR, path.normalize(stored).replace(/^(\.\.[\/\\])+/, ""));
    if (!file.startsWith(LOCAL_DIR + path.sep)) return null;
    return await fs.readFile(file);
  } catch {
    return null;
  }
}

export async function deleteImages(stored: (string | null | undefined)[]): Promise<void> {
  const list = stored.filter((s): s is string => !!s);
  if (!list.length) return;
  const remote = list.filter((s) => /^https?:\/\//.test(s));
  if (remote.length) {
    const { del } = await import("@vercel/blob");
    await del(remote).catch(() => {});
  }
  for (const s of list.filter((s) => !/^https?:\/\//.test(s))) {
    const file = path.join(LOCAL_DIR, path.normalize(s));
    if (file.startsWith(LOCAL_DIR + path.sep)) await fs.unlink(file).catch(() => {});
  }
}
