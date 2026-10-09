import { requireUser } from "@/lib/auth";
import { ROLE_HELP, ROLE_LABELS } from "@/lib/roles";
import { logoutAction } from "@/features/auth/actions";
import { ChangePassword } from "@/features/auth/ChangePassword";

export default async function AccountPage() {
  const me = await requireUser();
  return (
    <main className="page narrow">
      <div className="lib-head">
        <h1>My account</h1>
      </div>
      <div className="card-panel" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600 }}>{me.name}</div>
        <div className="count">{me.email}</div>
        <p style={{ marginBottom: 0 }}>
          <span className="badge">{ROLE_LABELS[me.role]}</span> <span className="count">{ROLE_HELP[me.role]}</span>
        </p>
      </div>
      <ChangePassword />
      <form action={logoutAction} style={{ marginTop: 16 }}>
        <button className="btn block">Sign out</button>
      </form>
    </main>
  );
}
