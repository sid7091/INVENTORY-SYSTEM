import { z } from "zod";
import { STATUSES, CATEGORIES, ASSIGNABLE_STATUSES } from "./constants";

// Coerce empty strings from forms to undefined before number parsing.
const optionalNumber = z
  .preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().finite())
  .optional();

const optionalInt = z
  .preprocess((v) => (v === "" || v == null ? undefined : v), z.coerce.number().int())
  .optional();

const optionalString = z
  .preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim())
  .optional();

export const blockSchema = z.object({
  blockNo: z.string().trim().min(1, "Block number is required"),
  quarryNo: optionalString,
  colour: z.string().trim().min(1, "Colour is required"),
  exporter: optionalString,
  quarry: optionalString,
  warehouse: optionalString,
  weightTons: optionalNumber,
  lengthCm: optionalNumber,
  heightCm: optionalNumber,
  pcs: optionalInt,
  endPcs: optionalInt,
  totalSft: optionalNumber,
  thicknessMm: optionalNumber,
  category: z.enum(CATEGORIES).default("HELIOS_LISTED"),
});

export type BlockInput = z.infer<typeof blockSchema>;

export const statusChangeSchema = z.object({
  status: z.enum(STATUSES).refine((s) => ASSIGNABLE_STATUSES.includes(s), {
    message: "That status cannot be set manually",
  }),
  reason: z.string().trim().min(3, "A reason is required for every status change"),
  // Piece numbers/ranges (e.g. "20-30, 35") — used for Partially Sold and Hold.
  pieces: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().optional(),
  ),
});

export const slabSchema = z.object({
  slabNo: z.string().trim().min(1),
  lengthCm: optionalNumber,
  heightCm: optionalNumber,
  thicknessMm: optionalNumber,
  sft: optionalNumber,
  status: z.enum(STATUSES).optional(),
  notes: optionalString,
});
