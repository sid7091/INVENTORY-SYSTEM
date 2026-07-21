import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const needsPhotos = await prisma.block.count({
    where: { deletedAt: null, status: "NEEDS_PHOTOS" },
  });

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      counts={{ needsPhotos }}
    >
      {children}
    </AppShell>
  );
}
