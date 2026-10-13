"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPassword, NotAllowedError, requireAdmin } from "@/lib/auth";
import { countActiveAdmins, createUser, deleteUser, findUserByEmail, getUser, getUserSelection, updateUser } from "@/lib/db";
import { ALL_ROLES, isRole } from "@/lib/roles";
import { clean } from "@/lib/text";
import type { ActionResult } from "@/lib/types";

// Easy to read out or type on a phone: no 0/O, 1/l/I.
function tempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 10 }, () => chars[randomInt(chars.length)]).join("");
}

async function guard<T>(fn: (me: { id: string }) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const me = await requireAdmin();
    const data = await fn(me);
    revalidatePath("/team");
    return { ok: true, data };
  } catch (e) {
    if (e instanceof NotAllowedError || e instanceof TeamError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

class TeamError extends Error {}

/** Stops the last admin from locking everyone out. */
async function assertNotLastAdmin(userId: string, change: { role?: string; status?: string } | "delete") {
  const u = await getUser(userId);
  if (!u || u.role !== "admin" || u.status !== "active") return;
  const losesAdmin = change === "delete" || (change.role && change.role !== "admin") || (change.status && change.status !== "active");
  if (losesAdmin && (await countActiveAdmins()) <= 1) throw new TeamError("There must always be at least one active admin.");
}

const newPersonSchema = z.object({
  name: z.string().trim().min(2, "Please enter a name."),
  email: z.string().trim().email("Please enter a valid email."),
  role: z.enum(ALL_ROLES),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

export async function createPersonAction(input: z.input<typeof newPersonSchema>) {
  return guard(async () => {
    const parsed = newPersonSchema.safeParse(input);
    if (!parsed.success) throw new TeamError(parsed.error.issues[0].message);
    const d = parsed.data;
    if (await findUserByEmail(d.email)) throw new TeamError("Someone with this email already has an account.");
    const password = tempPassword();
    await createUser({
      email: d.email,
      name: d.name,
      role: d.role,
      status: "active",
      passwordHash: await hashPassword(password),
      phone: clean(d.phone),
      company: clean(d.company),
      city: clean(d.city),
    });
    return { email: d.email.toLowerCase(), name: d.name, phone: clean(d.phone), password };
  });
}

export async function approveAction(id: string, role?: string) {
  return guard(async () => {
    await updateUser(id, { status: "active", ...(role && isRole(role) ? { role } : {}) });
  });
}

export async function setRoleAction(id: string, role: string) {
  return guard(async (me) => {
    if (!isRole(role)) throw new TeamError("Unknown role.");
    if (id === me.id) throw new TeamError("You can't change your own role. Ask another admin.");
    await assertNotLastAdmin(id, { role });
    await updateUser(id, { role });
  });
}

export async function setActiveAction(id: string, active: boolean) {
  return guard(async (me) => {
    if (id === me.id) throw new TeamError("You can't switch off your own account.");
    await assertNotLastAdmin(id, { status: active ? "active" : "disabled" });
    await updateUser(id, { status: active ? "active" : "disabled" });
  });
}

export async function resetPasswordAction(id: string) {
  return guard(async () => {
    const u = await getUser(id);
    if (!u) throw new TeamError("That person no longer exists.");
    const password = tempPassword();
    await updateUser(id, { passwordHash: await hashPassword(password) });
    return { email: u.email, name: u.name, phone: u.phone, password };
  });
}

export async function deletePersonAction(id: string) {
  return guard(async (me) => {
    if (id === me.id) throw new TeamError("You can't delete your own account.");
    await assertNotLastAdmin(id, "delete");
    await deleteUser(id);
  });
}

export async function selectionOfAction(id: string) {
  return guard(async () =>
    (await getUserSelection(id)).map((s) => ({ id: s.slab.id, name: s.slab.name, block: s.slab.block, status: s.slab.status })),
  );
}
