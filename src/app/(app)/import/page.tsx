import { PageHeader } from "@/components/PageHeader";
import { ImportWizard } from "@/components/ImportWizard";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Bulk Excel Import"
        subtitle="Validation preview → dry-run → transactional commit. New blocks enter the photo gate."
      />
      <div className="p-6">
        <ImportWizard />
      </div>
    </div>
  );
}
