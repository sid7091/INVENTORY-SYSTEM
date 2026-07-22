import "server-only";
import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

export interface ChangeSet {
  [field: string]: { from: unknown; to: unknown };
}

// Compute a { field: {from, to} } diff between two records for a set of keys.
export function diff(before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]): ChangeSet {
  const changes: ChangeSet = {};
  for (const k of keys) {
    const a = before?.[k] ?? null;
    const b = after?.[k] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes[k] = { from: a, to: b };
    }
  }
  return changes;
}

export async function logAudit(
  client: Client,
  params: {
    action: string;
    userId?: string | null;
    blockId?: string | null;
    reason?: string | null;
    changes?: ChangeSet | null;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      action: params.action,
      userId: params.userId ?? null,
      blockId: params.blockId ?? null,
      reason: params.reason ?? null,
      changes: params.changes ? JSON.stringify(params.changes) : null,
    },
  });
}
