import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { AuthForm } from "../auth-form";
import { signUp } from "../actions";

export const metadata: Metadata = { title: "Create pilot profile" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const nextPath = typeof next === "string" ? next : "/dashboard";

  return (
    <AuthShell
      eyebrow="Create pilot profile"
      title="Get cleared in."
      subtitle="Free. Unlocks the full clip library and lets you book sessions."
      footer={
        <>
          Already have a profile?{" "}
          <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="link">
            Sign in ›
          </Link>
        </>
      }
    >
      <AuthForm
        action={signUp}
        submit="Create profile"
        hidden={{ next: nextPath }}
        fields={[
          { name: "full_name", label: "Your name", autoComplete: "name" },
          { name: "email", label: "Email", type: "email", autoComplete: "email" },
          { name: "password", label: "Password", type: "password", autoComplete: "new-password", placeholder: "8+ characters" },
        ]}
      />
    </AuthShell>
  );
}
