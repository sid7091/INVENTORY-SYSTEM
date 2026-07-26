"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { checkPermission, PERMISSION_DENIED_MSG, hashPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ALL_CAPABILITY_KEYS } from "@/lib/permissionDefs";
import type { ActionResult } from "./blocks";

export interface RoleView {
  id: string;
  name: string;
  permissions: string[];
  uiMode: "full" | "simple";
  isPreset: boolean;
  userCount: number;
}

export interface UserView {
  id: string;
  name: string;
  email: string;
  active: boolean;
  roleId: string | null;
  roleName: string;
}

export async function getUsersAndRoles(): Promise<{ users: UserView[]; roles: RoleView[] }> {
  const user = await checkPermission("admin.users");
  if (!user) return { users: [], roles: [] };

  const [users, roles] = await Promise.all([
    prisma.user.findMany({ include: { roleRef: true }, orderBy: { createdAt: "asc" } }),
    prisma.role.findMany({ include: { _count: { select: { users: true } } }, orderBy: [{ isPreset: "desc" }, { createdAt: "asc" }] }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      active: u.active,
      roleId: u.roleId,
      roleName: u.roleRef?.name ?? (u.role === "ADMIN" ? "Admin" : "Staff"),
    })),
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: safeParse(r.permissions),
      uiMode: r.uiMode === "simple" ? "simple" : "full",
      isPreset: r.isPreset,
      userCount: r._count.users,
    })),
  };
}

function safeParse(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((k) => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function sanitizePermissions(keys: string[]): string[] {
  return keys.filter((k) => ALL_CAPABILITY_KEYS.includes(k));
}

export async function createUser(input: { name: string; email: string; password: string; roleId: string }): Promise<ActionResult> {
  const admin = await checkPermission("admin.users");
  if (!admin) return { ok: false, error: PERMISSION_DENIED_MSG };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) return { ok: false, error: "Enter a name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (input.password.length < 6) return { ok: false, error: "Password must be at least 6 characters." };

  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) return { ok: false, error: "Pick a role." };

  const dupe = await prisma.user.findUnique({ where: { email } });
  if (dupe) return { ok: false, error: "A user with that email already exists." };

  const created = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(input.password),
      role: role.name === "Admin" ? "ADMIN" : "STAFF", // legacy mirror
      roleId: role.id,
    },
  });
  await logAudit(prisma, { action: "USER_CREATE", userId: admin.userId, reason: `Created user ${created.email} with role ${role.name}` });
  revalidatePath("/admin");
  return { ok: true, id: created.id };
}

export async function updateUser(
  userId: string,
  input: { roleId?: string; active?: boolean; newPassword?: string },
): Promise<ActionResult> {
  const admin = await checkPermission("admin.users");
  if (!admin) return { ok: false, error: PERMISSION_DENIED_MSG };

  const target = await prisma.user.findUnique({ where: { id: userId }, include: { roleRef: true } });
  if (!target) return { ok: false, error: "User not found." };

  // Never let an admin lock themselves out mid-session.
  if (userId === admin.userId && input.active === false) {
    return { ok: false, error: "You can't deactivate your own account." };
  }

  const data: Record<string, unknown> = {};
  const notes: string[] = [];

  if (input.roleId !== undefined) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) return { ok: false, error: "Role not found." };
    // Guard the last admin: at least one active user must keep admin.users.
    if (userId === admin.userId && !safeParse(role.permissions).includes("admin.users")) {
      const otherAdmins = await countOtherUserAdmins(userId);
      if (otherAdmins === 0) return { ok: false, error: "You're the only admin — assign another admin first." };
    }
    data.roleId = role.id;
    data.role = role.name === "Admin" ? "ADMIN" : "STAFF";
    notes.push(`role → ${role.name}`);
  }
  if (input.active !== undefined) {
    data.active = input.active;
    notes.push(input.active ? "activated" : "deactivated");
  }
  if (input.newPassword) {
    if (input.newPassword.length < 6) return { ok: false, error: "Password must be at least 6 characters." };
    data.passwordHash = await hashPassword(input.newPassword);
    notes.push("password reset");
  }
  if (Object.keys(data).length === 0) return { ok: true };

  await prisma.user.update({ where: { id: userId }, data });
  await logAudit(prisma, { action: "USER_UPDATE", userId: admin.userId, reason: `Updated ${target.email}: ${notes.join(", ")}` });
  revalidatePath("/admin");
  return { ok: true };
}

async function countOtherUserAdmins(excludeUserId: string): Promise<number> {
  const users = await prisma.user.findMany({ where: { active: true, id: { not: excludeUserId } }, include: { roleRef: true } });
  return users.filter((u) => (u.roleRef ? safeParse(u.roleRef.permissions).includes("admin.users") : u.role === "ADMIN")).length;
}

export async function createRole(input: { name: string; permissions: string[]; uiMode: "full" | "simple" }): Promise<ActionResult> {
  const admin = await checkPermission("admin.users");
  if (!admin) return { ok: false, error: PERMISSION_DENIED_MSG };

  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the role a name." };
  const dupe = await prisma.role.findUnique({ where: { name } });
  if (dupe) return { ok: false, error: "A role with that name already exists." };

  const created = await prisma.role.create({
    data: {
      name,
      permissions: JSON.stringify(sanitizePermissions(input.permissions)),
      uiMode: input.uiMode === "simple" ? "simple" : "full",
    },
  });
  await logAudit(prisma, { action: "ROLE_CREATE", userId: admin.userId, reason: `Created role ${name}` });
  revalidatePath("/admin");
  return { ok: true, id: created.id };
}

export async function updateRole(
  roleId: string,
  input: { name?: string; permissions?: string[]; uiMode?: "full" | "simple" },
): Promise<ActionResult> {
  const admin = await checkPermission("admin.users");
  if (!admin) return { ok: false, error: PERMISSION_DENIED_MSG };

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) return { ok: false, error: "Role not found." };
  // The Admin preset is the safety anchor — always full access, not editable.
  if (role.isPreset && role.name === "Admin") {
    return { ok: false, error: "The Admin role can't be edited." };
  }

  const data: Record<string, unknown> = {};
  if (input.name !== undefined && !role.isPreset) {
    const name = input.name.trim();
    if (!name) return { ok: false, error: "Give the role a name." };
    const dupe = await prisma.role.findFirst({ where: { name, id: { not: roleId } } });
    if (dupe) return { ok: false, error: "A role with that name already exists." };
    data.name = name;
  }
  if (input.permissions !== undefined) data.permissions = JSON.stringify(sanitizePermissions(input.permissions));
  if (input.uiMode !== undefined) data.uiMode = input.uiMode === "simple" ? "simple" : "full";

  await prisma.role.update({ where: { id: roleId }, data });
  await logAudit(prisma, { action: "ROLE_UPDATE", userId: admin.userId, reason: `Updated role ${role.name}` });
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const admin = await checkPermission("admin.users");
  if (!admin) return { ok: false, error: PERMISSION_DENIED_MSG };

  const role = await prisma.role.findUnique({ where: { id: roleId }, include: { _count: { select: { users: true } } } });
  if (!role) return { ok: false, error: "Role not found." };
  if (role.isPreset) return { ok: false, error: "Preset roles can't be deleted." };
  if (role._count.users > 0) return { ok: false, error: "Move its users to another role first." };

  await prisma.role.delete({ where: { id: roleId } });
  await logAudit(prisma, { action: "ROLE_DELETE", userId: admin.userId, reason: `Deleted role ${role.name}` });
  revalidatePath("/admin");
  return { ok: true };
}
