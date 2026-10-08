"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { matchesQuery } from "@/lib/search";
import type { SlabSummary } from "@/lib/types";
import { SlabCard } from "./SlabCard";

type StatusFilter = "available" | "sold" | "all";
const STATUS_LABELS: Record<StatusFilter, string> = { available: "Available", sold: "Sold", all: "Available + sold" };

// Filters are remembered for this browser tab, so coming back from a slab
// keeps your search.
function useRemembered<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw !== null) setV(JSON.parse(raw));
    } catch {}
  }, [key]);
  const set = (next: T) => {
    setV(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [v, set];
}

export function LibraryView({
  slabs,
  canEdit,
  showStatusFilter,
}: {
  slabs: SlabSummary[];
  canEdit: boolean;
  showStatusFilter: boolean;
}) {
  const [query, setQuery] = useRemembered("lib.q", "");
  const [material, setMaterial] = useRemembered<string | null>("lib.material", null);
  const [status, setStatus] = useRemembered<StatusFilter>("lib.status", "available");

  const materials = useMemo(
    () => Array.from(new Set(slabs.map((s) => s.material).filter((m): m is string => !!m))).sort(),
    [slabs],
  );

  const visible = useMemo(
    () =>
      slabs.filter(
        (s) =>
          (status === "all" || s.status === status) &&
          (!material || s.material === material) &&
          matchesQuery(s, query),
      ),
    [slabs, status, material, query],
  );

  const total = slabs.filter((s) => s.status === "available").length;

  return (
    <main className="page">
      <div className="lib-head">
        <h1>Slab library</h1>
        <span className="count">
          {total} slab{total === 1 ? "" : "s"}
        </span>
      </div>

      <div className="searchbar">
        <input
          className="input"
          type="search"
          inputMode="search"
          placeholder="Search name, material, colour or block no."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search slabs"
        />
        <div className="chips" role="group" aria-label="Material">
          <button className="chip" aria-pressed={!material} onClick={() => setMaterial(null)}>
            All
          </button>
          {materials.map((m) => (
            <button key={m} className="chip" aria-pressed={material === m} onClick={() => setMaterial(material === m ? null : m)}>
              {m}
            </button>
          ))}
        </div>
        {showStatusFilter && (
          <div className="filters-row" role="group" aria-label="Status">
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
              <button key={k} className="chip status" aria-pressed={status === k} onClick={() => setStatus(k)}>
                {STATUS_LABELS[k]}
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length ? (
        <div className="grid">
          {visible.map((s) => (
            <SlabCard key={s.id} slab={s} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          {slabs.length === 0 ? (
            <p>The library is empty.{canEdit ? " Tap “Add slab” to add the first one." : ""}</p>
          ) : (
            <>
              <p>No slabs match{query ? ` “${query}”` : ""}.</p>
              <button
                className="btn"
                onClick={() => {
                  setQuery("");
                  setMaterial(null);
                  setStatus("available");
                }}
              >
                Clear search
              </button>
            </>
          )}
        </div>
      )}

      {canEdit && (
        <Link className="fab" href="/slab/new">
          + Add slab
        </Link>
      )}
    </main>
  );
}
