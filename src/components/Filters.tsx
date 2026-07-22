"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { STATUS_LABELS, CATEGORY_LABELS, ASSIGNABLE_STATUSES, type Category } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Options {
  colours: string[];
  exporters: string[];
  quarries: string[];
  thicknesses: number[];
}

export function Filters({ options, showStatus = true }: { options: Options; showStatus?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("view"); // preserve view separately below
      const view = params.get("view");
      if (view) next.set("view", view);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const get = (k: string) => params.get(k) ?? "";
  const activeCount = ["q", "colour", "exporter", "quarry", "thickness", "status", "category"].filter((k) => params.get(k)).length;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex w-full items-center gap-2 lg:w-auto lg:flex-1">
        <input
          className="input flex-1 lg:min-w-[180px]"
          placeholder="Search block no, colour, exporter…"
          defaultValue={get("q")}
          onChange={(e) => setParam("q", e.target.value)}
        />
        <button
          type="button"
          className={cn("btn-secondary shrink-0 lg:hidden", open && "bg-cream-200")}
          onClick={() => setOpen((o) => !o)}
        >
          Filters{activeCount > 0 && ` (${activeCount})`}
        </button>
      </div>

      {/* On mobile this whole group toggles as one block; lg:contents makes
          the wrapper disappear at desktop so its children flow inline with
          the search box + toggle above, exactly like before this change. */}
      <div className={cn("w-full flex-wrap gap-2 lg:contents", open ? "flex" : "hidden lg:contents")}>
        <select className="input w-full lg:w-auto" value={get("colour")} onChange={(e) => setParam("colour", e.target.value)}>
          <option value="">All colours</option>
          {options.colours.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="input w-full lg:w-auto" value={get("exporter")} onChange={(e) => setParam("exporter", e.target.value)}>
          <option value="">All exporters</option>
          {options.exporters.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="input w-full lg:w-auto" value={get("quarry")} onChange={(e) => setParam("quarry", e.target.value)}>
          <option value="">All quarries</option>
          {options.quarries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select className="input w-full lg:w-auto" value={get("thickness")} onChange={(e) => setParam("thickness", e.target.value)}>
          <option value="">All thickness</option>
          {options.thicknesses.map((t) => <option key={t} value={String(t)}>{t} MM</option>)}
        </select>

        <select className="input w-full lg:w-auto" value={get("category")} onChange={(e) => setParam("category", e.target.value)}>
          <option value="">All categories</option>
          {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>

        {showStatus && (
          <select className="input w-full lg:w-auto" value={get("status")} onChange={(e) => setParam("status", e.target.value)}>
            <option value="">All statuses</option>
            {ASSIGNABLE_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        )}

        {activeCount > 0 && (
          <button className="btn-ghost w-full text-xs lg:w-auto" onClick={() => router.replace(pathname)}>
            Clear filters ({activeCount})
          </button>
        )}
      </div>
    </div>
  );
}

export function ViewToggle({ current }: { current: "grid" | "list" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setView = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set("view", v);
    router.replace(`${pathname}?${next.toString()}`);
  };
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-tan-300">
      {(["grid", "list"] as const).map((v) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-3 py-1.5 text-sm font-medium capitalize ${current === v ? "bg-brown-700 text-cream-50" : "bg-cream-50 text-brown-600 hover:bg-cream-200"}`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}
