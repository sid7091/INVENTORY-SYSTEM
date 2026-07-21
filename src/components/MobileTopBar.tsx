"use client";
import Link from "next/link";
import { BRAND } from "@/lib/brand";

export function MobileTopBar({
  onOpenMenu,
  needsPhotos,
}: {
  onOpenMenu: () => void;
  needsPhotos: number;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-tan-200 bg-cream-50/95 px-3 py-2.5 backdrop-blur lg:hidden">
      <button
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-10 w-10 items-center justify-center rounded-md text-xl text-brown-700 hover:bg-cream-200"
      >
        ☰
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brown-700 text-sm font-bold text-cream-50">{BRAND.monogram}</div>
        <span className="font-serif text-base font-bold text-brown-800">{BRAND.short}</span>
      </div>
      {needsPhotos > 0 && (
        <Link href="/needs-photos" className="badge ml-auto bg-amber-200 text-amber-900">
          {needsPhotos} needs photos
        </Link>
      )}
    </header>
  );
}
