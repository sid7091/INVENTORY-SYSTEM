import type { SlabFields } from "@/lib/types";

/** The WhatsApp caption. Lines with an empty field are left out. */
export function slabCaption(s: SlabFields): string {
  const lines = [
    `*${s.name}*`,
    s.material && `Material: ${s.material}`,
    s.color && `Colour: ${s.color}`,
    s.size && `Size: ${s.size}`,
    s.quantity && `Quantity: ${s.quantity}`,
    s.block && `Block no: ${s.block}`,
  ];
  return lines.filter(Boolean).join("\n");
}
