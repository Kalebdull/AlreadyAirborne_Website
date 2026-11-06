import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../auth-shell";
import { AuthForm } from "../auth-form";
import { requestReset } from "../actions";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Lost comms"
      title="Reset your password."
      subtitle="Enter your email and I'll send you a reset link."
      footer={
        <Link href="/login" className="link">
          ‹ Back to sign in
        </Link>
      }
    >
      <AuthForm
        action={requestReset}
        submit="Send reset link"
        fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]}
      />
    </AuthShell>
  );
}
