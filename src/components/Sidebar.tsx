"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: "▚" },
  { href: "/inventory", label: "Inventory", icon: "▦" },
  { href: "/needs-photos", label: "Needs Photos", icon: "◫", badgeKey: "needsPhotos" },
  { href: "/photo-room", label: "Photo Room", icon: "⬆" },
  { href: "/import", label: "Import", icon: "⤓" },
  { href: "/reports", label: "Reports", icon: "▤" },
  { href: "/audit", label: "Audit Log", icon: "≣" },
  { href: "/trash", label: "Trash", icon: "🗑" },
];

export function Sidebar({
  user,
  counts,
}: {
  user: { name: string; email: string; role: string };
  counts: { needsPhotos: number };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-tan-200 bg-cream-50">
      <div className="flex items-center gap-3 border-b border-tan-200 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brown-700 font-bold text-cream-50">H</div>
        <div>
          <div className="font-serif text-base font-bold leading-tight text-brown-800">Helios</div>
          <div className="text-[11px] text-brown-400">Inventory</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const badge = item.badgeKey === "needsPhotos" ? counts.needsPhotos : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-brown-700 text-cream-50" : "text-brown-600 hover:bg-cream-200",
              )}
            >
              <span className="flex items-center gap-3">
                <span className="w-4 text-center opacity-80">{item.icon}</span>
                {item.label}
              </span>
              {badge > 0 && (
                <span className={cn("badge", active ? "bg-cream-50 text-brown-700" : "bg-amber-200 text-amber-900")}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-tan-200 p-3">
        <div className="mb-2 px-2">
          <div className="truncate text-sm font-medium text-brown-800">{user.name}</div>
          <div className="truncate text-[11px] text-brown-400">{user.email} · {user.role}</div>
        </div>
        <button onClick={logout} className="btn-secondary w-full text-xs">Sign out</button>
      </div>
    </aside>
  );
}
