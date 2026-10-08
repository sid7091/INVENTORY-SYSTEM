"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type FormState } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(registerAction, {});
  const v = state.values ?? {};

  if (state.done) {
    return (
      <div>
        <p className="notice success">
          Thank you! Your request has been sent to Helios. We&apos;ll approve your account shortly, and then you can sign in
          with your email and password.
        </p>
        <Link className="btn block" href="/login" style={{ marginTop: 14 }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action}>
      <div className="field">
        <label>I am</label>
        <div className="seg">
          <label>
            <input type="radio" name="role" value="architect" defaultChecked={v.role !== "customer"} /> Architect
          </label>
          <label>
            <input type="radio" name="role" value="customer" defaultChecked={v.role === "customer"} /> Customer
          </label>
        </div>
      </div>
      <div className="field">
        <label htmlFor="name">Full name</label>
        <input className="input" id="name" name="name" defaultValue={v.name} autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input className="input" id="email" name="email" defaultValue={v.email} type="email" autoComplete="email" inputMode="email" required />
      </div>
      <div className="field">
        <label htmlFor="phone">Phone / WhatsApp</label>
        <input className="input" id="phone" name="phone" defaultValue={v.phone} type="tel" autoComplete="tel" inputMode="tel" required />
      </div>
      <div className="field">
        <label htmlFor="company">Firm or company (optional)</label>
        <input className="input" id="company" name="company" defaultValue={v.company} autoComplete="organization" />
      </div>
      <div className="field">
        <label htmlFor="city">City (optional)</label>
        <input className="input" id="city" name="city" defaultValue={v.city} autoComplete="address-level2" />
      </div>
      <div className="field">
        <label htmlFor="note">What are you looking for? (optional)</label>
        <textarea className="input" id="note" name="note" defaultValue={v.note} maxLength={500} placeholder="e.g. Kitchen island in a backlit quartzite" />
      </div>
      <div className="field">
        <label htmlFor="password">Choose a password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <span className="hint">At least 8 characters.</span>
      </div>
      {state.error && <p className="notice error" role="alert">{state.error}</p>}
      <button className="btn primary block" disabled={pending} style={{ marginTop: 8 }}>
        {pending ? "Sending…" : "Request access"}
      </button>
    </form>
  );
}
