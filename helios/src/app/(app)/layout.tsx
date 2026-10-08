import { requireUser } from "@/lib/auth";
import { getSelectionIds } from "@/lib/db";
import { SelectionProvider } from "@/features/library/Selection";
import { SelectionBar } from "@/features/library/SelectionBar";
import { ToastProvider } from "@/features/ui/Toast";
import { TopBar } from "@/features/ui/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const selected = await getSelectionIds(me.id);
  return (
    <ToastProvider>
      <SelectionProvider initial={selected}>
        <TopBar name={me.name} role={me.role} />
        {children}
        <SelectionBar />
      </SelectionProvider>
    </ToastProvider>
  );
}
