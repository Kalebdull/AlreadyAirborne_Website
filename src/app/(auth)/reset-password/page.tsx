import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { AuthShell } from "../auth-shell";
import { AuthForm } from "../auth-form";
import { updatePassword } from "../actions";

export const metadata: Metadata = { title: "New password" };

export default async function ResetPasswordPage() {
  // The reset link signs the user in via /auth/confirm before landing here.
  await requireViewer("/reset-password");

  return (
    <AuthShell eyebrow="Lost comms" title="Choose a new password.">
      <AuthForm
        action={updatePassword}
        submit="Save password"
        fields={[
          { name: "password", label: "New password", type: "password", autoComplete: "new-password", placeholder: "8+ characters" },
        ]}
      />
    </AuthShell>
  );
}
