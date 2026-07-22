import "server-only";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const IMAGE_MIME = /^image\//;

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
}

// Accepts a full "share" URL (folders/<id>, ?id=<id>, open?id=<id>) or a bare
// folder ID typed directly, and returns just the ID Drive's API wants.
export function extractFolderId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return null;
}

class DriveApiError extends Error {}

async function driveFetch(path: string, apiKey: string): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${DRIVE_API}${path}${sep}key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DriveApiError(`Google Drive API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// List the immediate children of a Drive folder (folders and files alike).
// Paginates through all pages; a shared folder with a modest number of block
// subfolders is expected, so this keeps it simple rather than streaming.
export async function listChildren(folderId: string, apiKey: string): Promise<DriveFileMeta[]> {
  const out: DriveFileMeta[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const fields = encodeURIComponent("nextPageToken, files(id, name, mimeType)");
    const pageParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "";
    const data = await driveFetch(`/files?q=${q}&fields=${fields}&pageSize=1000${pageParam}`, apiKey);
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

export function isDriveFolder(f: DriveFileMeta): boolean {
  return f.mimeType === "application/vnd.google-apps.folder";
}

export function isDriveImage(f: DriveFileMeta): boolean {
  return IMAGE_MIME.test(f.mimeType);
}

// Download a file's raw bytes.
export async function downloadDriveFile(fileId: string, apiKey: string): Promise<Buffer> {
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media&key=${encodeURIComponent(apiKey)}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new DriveApiError(`Google Drive download ${res.status}: ${body.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
