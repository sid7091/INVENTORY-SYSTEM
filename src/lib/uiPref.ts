// Per-person UI preference, independent of role. Anyone can choose the simple
// icon-first app from the burger menu — useful on a phone in the yard even for
// managers. A role whose uiMode is "simple" is still confined to it: the
// preference can only ever make the UI simpler, never unlock the full app.

export const UI_PREF_COOKIE = "uiPref";
export type UiPref = "simple" | "full";

export function isUiPref(v: string | undefined | null): v is UiPref {
  return v === "simple" || v === "full";
}
