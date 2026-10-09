"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" defaultValue={state.values?.email} type="email" autoComplete="email" inputMode="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      <button className="btn primary block" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
