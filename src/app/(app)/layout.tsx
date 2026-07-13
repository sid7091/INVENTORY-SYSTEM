import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const needsPhotos = await prisma.block.count({
    where: { deletedAt: null, status: "NEEDS_PHOTOS" },
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        user={{ name: user.name, email: user.email, role: user.role }}
        counts={{ needsPhotos }}
      />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
