import "server-only";
import nodemailer from "nodemailer";
import { site } from "@/lib/site";

// Heads-up emails to the instructor (new booking requests, new sign-ups),
// sent through Gmail with an app password. Without the env vars this is a
// no-op, so local development never sends mail.
const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
const to = process.env.NOTIFY_EMAIL || site.email;

const transport = user && pass ? nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } }) : null;

export async function notifyInstructor(subject: string, lines: string[], link?: { label: string; path: string }) {
  if (!transport) return;
  const url = link ? `${site.url}${link.path}` : null;
  const text = [...lines, "", url ? `${link!.label}: ${url}` : "", "", "— AlreadyAirborne"].join("\n");
  try {
    await transport.sendMail({ from: `AlreadyAirborne <${user}>`, to, subject: `[AlreadyAirborne] ${subject}`, text });
  } catch (error) {
    console.error("notifyInstructor failed:", error);
  }
}
