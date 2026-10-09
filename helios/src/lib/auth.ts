import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifyToken } from "./session";
import { canEdit, canHardDelete, canManageTeam, type Role } from "./roles";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function startSession(user: { id: string; email: string; name: string; role: string }) {
  const token = await signSession({ userId: user.id, email: user.email, name: user.name, role: user.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The signed-in user, re-read from the database so that a role change or a
 * disabled account takes effect on the very next request (the cookie alone is
 * never trusted for permissions).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifyToken(token);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || user.status !== "active") return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class NotAllowedError extends Error {
  constructor(message = "You don't have permission to do this. Ask an admin.") {
    super(message);
  }
}

async function requireWith(check: (role: string) => boolean): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new NotAllowedError("Your session has ended. Please sign in again.");
  if (!check(user.role)) throw new NotAllowedError();
  return user;
}

export const requireEditor = () => requireWith(canEdit);
export const requireAdmin = () => requireWith(canManageTeam);
export const requireHardDelete = () => requireWith(canHardDelete);
