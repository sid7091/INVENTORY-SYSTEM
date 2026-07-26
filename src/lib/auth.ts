import "server-only";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { getSession, type SessionPayload } from "./session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Server-side guard: returns the session or redirects to /login.
export async function requireUser(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export const PERMISSION_DENIED_MSG = "You don't have permission to do this. Ask an admin.";

// Capability check for server actions and API routes. Resolves from the DB
// (not the JWT) so role edits apply immediately. Returns the session when
// allowed, or null — callers turn that into { ok:false } / a 403 (a thrown
// error would be redacted by Next in production).
export async function checkPermission(capability: string): Promise<SessionPayload | null> {
  const session = await requireUser();
  const { hasPermission } = await import("./permissions");
  return (await hasPermission(session.userId, capability)) ? session : null;
}

export async function authenticate(
  email: string,
  password: string,
): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}
