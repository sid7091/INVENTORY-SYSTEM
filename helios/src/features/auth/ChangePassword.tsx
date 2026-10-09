"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "./actions";

export function ChangePassword() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="card-panel">
      <h3 style={{ marginBottom: 12 }}>Change password</h3>
      <div className="field">
        <label htmlFor="current">Current password</label>
        <input className="input" id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="next">New password</label>
        <input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      {state.error && <p className="notice error">{state.error}</p>}
      {state.done && <p className="notice success">Password changed.</p>}
      <button className="btn primary" disabled={pending}>
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
