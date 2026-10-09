// The one rule for turning a block field into duplicate-check keys.
// "29596 / HCS 593" -> ["29596", "hcs593"]
// Used by the editor (live warning) and by the server, which writes the keys
// into the BlockKey table whose primary key refuses duplicates.

const SPLIT = /\s*(?:[\/,;|&+]|\band\b)\s*/i;

export function blockKeysOf(block: string): string[] {
  const keys = block
    .split(SPLIT)
    .map((part) =>
      part
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
    )
    .filter((k) => k.length >= 2);
  return Array.from(new Set(keys));
}
