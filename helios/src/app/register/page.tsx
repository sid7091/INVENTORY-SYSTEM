import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { AuthShell } from "@/features/auth/AuthShell";
import { RegisterForm } from "@/features/auth/RegisterForm";

export default function RegisterPage() {
  if (!brand.allowClientRegistration) redirect("/login");
  return (
    <AuthShell
      title="Request access"
      foot={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
