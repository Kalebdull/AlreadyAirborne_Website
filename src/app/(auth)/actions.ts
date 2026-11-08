"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { after } from "next/server";
import { notifyInstructor } from "@/lib/notify";

export type FormState = { error?: string; message?: string } | undefined;

// Only allow redirects back into this site.
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
}

const notConfigured = { error: "The site isn't connected to its database yet." };

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  if (!hasSupabase) return notConfigured;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (error) return { error: "That email and password don't match. Say again?" };
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  if (!hasSupabase) return notConfigured;
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!fullName) return { error: "Add your name so I know who's booking." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };

  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) return { error: error.message };
  after(() =>
    notifyInstructor("New sign-up", [`${fullName} (${email}) just created an account.`], { label: "See your students", path: "/admin/students" }),
  );

  // With email confirmation on, there's no session until they click the link.
  if (!data.session) {
    return { message: `Check ${email} for a confirmation link, then you're cleared to sign in.` };
  }
  redirect(next);
}

export async function requestReset(_: FormState, formData: FormData): Promise<FormState> {
  if (!hasSupabase) return notConfigured;
  const supabase = await createClient();
  const email = String(formData.get("email") ?? "").trim();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/confirm?next=/reset-password`,
  });
  // Same answer either way, so this can't be used to probe for accounts.
  return { message: `If ${email} has an account, a reset link is on its way.` };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  if (!hasSupabase) return notConfigured;
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "That reset link has expired. Request a new one." };
  redirect("/dashboard");
}
