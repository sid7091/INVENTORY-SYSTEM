"use client";
import { useRouter } from "next/navigation";
import { LANGS, LANG_COOKIE, type Lang } from "@/lib/i18n";

// Three always-visible buttons (no dropdown to discover) — a worker taps the
// script they recognise. The choice persists for a year via cookie.
export function LanguageSwitcher({ current, size = "sm" }: { current: Lang; size?: "sm" | "lg" }) {
  const router = useRouter();

  function pick(code: Lang) {
    document.cookie = `${LANG_COOKIE}=${code};path=/;max-age=31536000;samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex gap-1" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => pick(l.code)}
          className={`rounded-md border px-2 ${size === "lg" ? "py-2 text-base" : "py-1 text-xs"} font-medium transition-colors ${
            current === l.code
              ? "border-brown-700 bg-brown-700 text-cream-50"
              : "border-tan-300 bg-cream-50 text-brown-600 hover:bg-cream-200"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
