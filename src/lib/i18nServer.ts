import "server-only";
import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, type Lang } from "./i18n";

export async function getLang(): Promise<Lang> {
  const store = await cookies();
  const v = store.get(LANG_COOKIE)?.value;
  return isLang(v) ? v : "en";
}
