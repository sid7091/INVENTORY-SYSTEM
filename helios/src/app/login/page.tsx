import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { getCurrentUser } from "@/lib/auth";
import { AuthShell } from "@/features/auth/AuthShell";
import { LoginForm } from "@/features/auth/LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  return (
    <AuthShell
      title={`${brand.shortName} ${brand.appTitle.toLowerCase()}`}
      foot={
        brand.allowClientRegistration ? (
          <>
            Architect or customer? <Link href="/register">Request access</Link>
          </>
        ) : (
          "Need access? Ask a Helios admin to invite you."
        )
      }
    >
      <LoginForm next={next ?? "/"} />
    </AuthShell>
  );
}
