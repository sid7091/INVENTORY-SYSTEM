import { brand } from "@/config/brand";

export function AuthShell({ title, children, foot }: { title: string; children: React.ReactNode; foot?: React.ReactNode }) {
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.assets.logoMain} alt={brand.name} />
        </div>
        <h1>{title}</h1>
        <p className="tag">{brand.tagline}</p>
        <div className="panel">{children}</div>
        {foot && <div className="foot">{foot}</div>}
      </div>
    </main>
  );
}
