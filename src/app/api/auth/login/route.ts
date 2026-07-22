import { NextRequest, NextResponse } from "next/server";
import { authenticate } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const session = await authenticate(email, password);
  if (!session) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  await createSession(session);
  await logAudit(prisma, { action: "LOGIN", userId: session.userId });
  return NextResponse.json({ ok: true });
}
