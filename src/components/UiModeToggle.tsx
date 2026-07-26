"use client";
import { useRouter } from "next/navigation";
import { UI_PREF_COOKIE, type UiPref } from "@/lib/uiPref";

function setPref(pref: UiPref) {
  document.cookie = `${UI_PREF_COOKIE}=${pref};path=/;max-age=31536000;samesite=lax`;
}

// "Switch to simple view" — available to everyone from the burger menu, so a
// manager can use the big-button app on a phone in the yard.
export function SwitchToSimple({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        setPref("simple");
        router.push("/w");
        router.refresh();
      }}
      className={className ?? "btn-secondary flex w-full items-center justify-center gap-2 text-xs"}
    >
      <span className="text-base">📱</span> Simple view
    </button>
  );
}

// The way back, shown in the simple app only for roles allowed the full app.
export function SwitchToFull({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        setPref("full");
        router.push("/");
        router.refresh();
      }}
      aria-label="Full app"
      className={className ?? "flex h-10 items-center justify-center gap-1.5 rounded-md border border-tan-300 bg-cream-50 px-3 text-sm font-medium text-brown-600 hover:bg-cream-200"}
    >
      <span className="text-base">🖥</span>
    </button>
  );
}
