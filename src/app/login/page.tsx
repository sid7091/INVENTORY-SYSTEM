import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { BRAND } from "@/lib/brand";
import { getLang } from "@/lib/i18nServer";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const lang = await getLang();
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-cream-100 via-cream-50 to-cream-200 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.wordmarkUrl} alt={BRAND.name} className="mx-auto mb-4 h-auto w-56 object-contain" />
          <p className="text-sm text-brown-500">Inventory · Staff sign-in</p>
        </div>
        <div className="card p-6">
          <div className="mb-4 flex justify-center">
            <LanguageSwitcher current={lang} size="lg" />
          </div>
          <Suspense fallback={<div className="text-center text-sm text-brown-400">Loading…</div>}>
            <LoginForm lang={lang} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-brown-400">
          {BRAND.name} · {BRAND.tagline} · Phase 1
        </p>
      </div>
    </div>
  );
}
