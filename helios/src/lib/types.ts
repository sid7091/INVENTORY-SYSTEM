// Shapes shared between server and browser.

export interface SlabImageView {
  id: string;
  label: string | null;
  position: number;
  width: number | null;
  height: number | null;
}

export interface SlabFields {
  name: string;
  material: string | null;
  color: string | null;
  size: string;
  quantity: string | null;
  block: string;
}

export interface SlabSummary extends SlabFields {
  id: string;
  status: "available" | "sold";
  coverId: string | null;
  imageCount: number;
  createdAt: string;
}

export interface SlabDetail extends SlabSummary {
  images: SlabImageView[];
  updatedAt: string;
}

export interface EditorImage {
  id: string; // an uploaded SlabImage id
  label: string | null;
}

export interface SaveSlabInput extends SlabFields {
  id?: string;
  images: EditorImage[]; // in order; first is the cover
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  company: string | null;
  city: string | null;
  note: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  selectionCount: number;
}
