"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { brand } from "@/config/brand";
import { endSession, hashPassword, requireUser, startSession, verifyPassword } from "@/lib/auth";
import { createUser, findUserByEmail, getUser, touchLogin, updateUser } from "@/lib/db";
import { CLIENT_ROLES } from "@/lib/roles";
import { clean } from "@/lib/text";

export interface FormState {
  error?: string;
  done?: boolean;
  /** What was typed, so the form can refill itself after an error (React resets forms after an action). */
  values?: Record<string, string>;
}

const typed = (form: FormData) =>
  Object.fromEntries([...form.entries()].filter(([k, v]) => typeof v === "string" && !/password|current|next/.test(k))) as Record<string, string>;

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  const values = typed(form);
  if (!email || !password) return { error: "Please enter your email and password.", values };

  const user = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match. Check them and try again.", values };
  }
  if (user.status === "pending") {
    return { error: "Your account is waiting for approval from Helios. We'll let you know when it's ready.", values };
  }
  if (user.status !== "active") {
    return { error: "This account has been switched off. Please contact Helios.", values };
  }
  await startSession(user);
  await touchLogin(user.id);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  await endSession();
  redirect("/login");
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().min(6, "Please enter a phone number we can reach you on."),
  company: z.string().trim().optional(),
  city: z.string().trim().optional(),
  role: z.enum(CLIENT_ROLES, { message: "Please choose Architect or Customer." }),
  password: z.string().min(8, "Use at least 8 characters for your password."),
  note: z.string().trim().max(500).optional(),
});

export async function registerAction(_: FormState, form: FormData): Promise<FormState> {
  if (!brand.allowClientRegistration) return { error: "Registration is closed. Please contact Helios for access." };
  const values = typed(form);
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const d = parsed.data;
  if (await findUserByEmail(d.email)) {
    return { error: "An account with this email already exists. Try signing in, or contact Helios.", values };
  }
  await createUser({
    email: d.email,
    name: d.name,
    passwordHash: await hashPassword(d.password),
    role: d.role,
    status: "pending",
    phone: clean(d.phone),
    company: clean(d.company),
    city: clean(d.city),
    note: clean(d.note),
  });
  return { done: true };
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const me = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 8) return { error: "Use at least 8 characters for the new password." };
  const user = await getUser(me.id);
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Your current password isn't right." };
  }
  await updateUser(me.id, { passwordHash: await hashPassword(next) });
  return { done: true };
}
