import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { AuthForm } from "../auth-form";
import { signIn } from "../actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  return (
    <AuthShell
      eyebrow="Preflight"
      title="Welcome back."
      subtitle="Sign in to book sessions and pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="link">
            Create a pilot profile ›
          </Link>
        </>
      }
    >
      {error === "link" && (
        <p role="alert" className="rounded-xl bg-red/10 px-4 py-3 text-[15px] text-red">
          That link has expired or was already used. Sign in, or request a new one.
        </p>
      )}
      <AuthForm
        action={signIn}
        submit="Sign in"
        hidden={{ next: nextPath }}
        fields={[
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
        ]}
      />
      <Link href="/forgot-password" className="link -mt-3 text-[15px]">
        Forgot your password?
      </Link>
    </AuthShell>
  );
}
