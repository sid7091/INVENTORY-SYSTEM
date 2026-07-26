import "server-only";
import { cookies } from "next/headers";
import { UI_PREF_COOKIE, isUiPref, type UiPref } from "./uiPref";

// Defaults to "full": without an explicit choice, a role's own uiMode decides.
export async function getUiPref(): Promise<UiPref> {
  const store = await cookies();
  const v = store.get(UI_PREF_COOKIE)?.value;
  return isUiPref(v) ? v : "full";
}
