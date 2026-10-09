"use client";

import { useEffect, useState } from "react";
import { imageUrl } from "@/lib/imageUrl";
import type { SlabDetail } from "@/lib/types";
import { brandedFileName, brandedPhoto } from "@/features/share/branded";

/**
 * Prepares the branded JPEG of every photo as soon as the slab is opened.
 * Phones only open the share sheet straight from a tap, so the files have to
 * be ready before the tap happens.
 */
export function useBrandedFiles(slab: SlabDetail) {
  const [files, setFiles] = useState<Record<string, File>>({});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFiles({});
    (async () => {
      for (const [i, img] of slab.images.entries()) {
        try {
          const blob = await brandedPhoto(imageUrl(img.id), slab);
          if (cancelled) return;
          const file = new File([blob], brandedFileName(slab, img.label, i), { type: "image/jpeg" });
          setFiles((prev) => ({ ...prev, [img.id]: file }));
        } catch {
          if (!cancelled) setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slab]);

  const all = slab.images.map((i) => files[i.id]).filter(Boolean);
  return { files, all, ready: all.length === slab.images.length, failed };
}
