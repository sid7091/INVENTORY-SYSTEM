// Public Drive thumbnail URL — works for anyone-with-the-link files, no API
// key needed, so client components (the Needs Actions page) can render
// previews straight in <img>. Deliberately has no "server-only" import,
// unlike src/lib/drive.ts and src/lib/driveSync.ts.
export function driveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
}
