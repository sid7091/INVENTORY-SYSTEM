"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badgeKey?: "needsPhotos";
}

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "▚" },
  { href: "/inventory", label: "Inventory", icon: "▦" },
  { href: "/needs-photos", label: "Needs Photos", icon: "◫", badgeKey: "needsPhotos" },
  { href: "/photo-room", label: "Photo Room", icon: "⬆" },
  { href: "/import", label: "Import", icon: "⤓" },
  { href: "/reports", label: "Reports", icon: "▤" },
  { href: "/audit", label: "Audit Log", icon: "≣" },
  { href: "/trash", label: "Trash", icon: "🗑" },
];

const ADMIN_NAV: NavItem[] = [{ href: "/admin", label: "Admin", icon: "⚙" }];

// Nav drawer: a fixed slide-over on phones/tablets (controlled by `open`),
// a permanent static column on desktop (lg+, ignores `open`/`onClose`).
export function Sidebar({
  user,
  counts,
  open,
  onClose,
}: {
  user: { name: string; email: string; role: string };
  counts: { needsPhotos: number };
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Close the drawer whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-brown-900/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-tan-200 bg-cream-50 shadow-cardhover transition-transform duration-200 ease-out",
          "lg:static lg:z-auto lg:w-60 lg:max-w-none lg:translate-x-0 lg:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-3 border-b border-tan-200 px-5 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BRAND.logoUrl} alt={BRAND.name} className="h-9 w-9 object-contain" />
          <div>
            <div className="font-serif text-base font-bold leading-tight text-brown-800">{BRAND.short}</div>
            <div className="text-[11px] text-brown-400">Inventory</div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-md text-xl text-brown-500 hover:bg-cream-200 lg:hidden"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {(user.role === "ADMIN" ? [...NAV, ...ADMIN_NAV] : NAV).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const badge = item.badgeKey === "needsPhotos" ? counts.needsPhotos : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors lg:py-2",
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
    </>
  );
}
