export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-tan-200 bg-cream-50/60 px-6 py-4">
      <div>
        <h1 className="font-serif text-xl font-bold text-brown-800">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-brown-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
