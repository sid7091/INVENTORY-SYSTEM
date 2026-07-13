import { PageHeader } from "@/components/PageHeader";
import { BlockForm } from "@/components/BlockForm";

export default function NewBlockPage() {
  return (
    <div>
      <PageHeader title="New Block" subtitle="Add a single block manually" />
      <div className="mx-auto max-w-4xl p-6">
        <BlockForm />
      </div>
    </div>
  );
}
