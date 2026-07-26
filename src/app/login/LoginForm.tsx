"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t, type Lang } from "@/lib/i18n";

export function LoginForm({ lang = "en" }: { lang?: Lang }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const next = params.get("next") || "/";
      router.push(next);
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">✉️ {t(lang, "email")}</label>
        <input id="email" type="email" autoComplete="username" required className="input"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@eaglestone.com" />
      </div>
      <div>
        <label className="label" htmlFor="password">🔑 {t(lang, "password")}</label>
        <input id="password" type="password" autoComplete="current-password" required className="input"
          value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "…" : `➜ ${t(lang, "signIn")}`}
      </button>
      <p className="text-center text-xs text-brown-400">Demo: admin@eaglestone.com / helios123</p>
    </form>
  );
}
