"use client";
import { useRouter } from "next/navigation";

export function WorkerSignOut() {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <button
      onClick={logout}
      aria-label="Sign out"
      className="flex h-10 w-10 items-center justify-center rounded-md border border-tan-300 bg-cream-50 text-lg text-brown-600 hover:bg-cream-200"
    >
      ⏻
    </button>
  );
}
