import { requireUser } from "@/lib/auth";
import { getLang } from "@/lib/i18nServer";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { WorkerSignOut } from "@/components/worker/WorkerSignOut";
import { BRAND } from "@/lib/brand";
import Link from "next/link";

// The factory-floor shell: no sidebar, no dense chrome — one column of big
// tap targets. The language buttons are always visible (never hidden behind
// a menu a worker would have to read to find).
export default async function WorkerLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const lang = await getLang();

  return (
    <div className="min-h-screen bg-cream-100">
      <header className="sticky top-0 z-30 border-b border-tan-200 bg-cream-50/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <Link href="/w" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BRAND.logoUrl} alt={BRAND.name} className="h-10 w-10 object-contain" />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSwitcher current={lang} />
            <WorkerSignOut />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 py-4 pb-24">{children}</main>
    </div>
  );
}
