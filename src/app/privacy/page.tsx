import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  const sections: [string, React.ReactNode][] = [
    [
      "What I collect",
      <>
        If you create an account: your name, email and password (stored securely by our login provider, never visible to me). If you book a session: the time you
        picked and any note you write. If you enter the flight-game contest: your callsign, email and recorded run.
      </>,
    ],
    [
      "Site stats",
      <>
        To see which videos and pages are useful, the site counts visits and flight-game runs: the pages you open, how far your runs get, what kind of device
        you&apos;re on, your approximate city, and the site that sent you (like Instagram). This uses a random ID stored in your browser. It doesn&apos;t use your IP
        address, cookies from other companies, or ad trackers. If you&apos;re signed in, your activity is linked to your account.
      </>,
    ],
    [
      "How it's used",
      "Only to run the site: confirming bookings, sending your Zoom link, verifying contest entries, contacting the contest winner, and improving the lessons. I don't sell or share your information. Emails about tips and updates only go to people who opted in.",
    ],
    [
      "Who else handles it",
      "The site runs on Vercel (hosting) and Supabase (accounts and database), and account emails are sent through Google. They process data only to provide those services.",
    ],
    [
      "Your choices",
      <>
        You can ask me to see or delete your account, bookings, contest entry or site stats at any time: email{" "}
        <a href={`mailto:${site.email}`} className="link">
          {site.email}
        </a>
        . Clearing your browser&apos;s site data resets the random ID.
      </>,
    ],
  ];

  return (
    <main className="px-6 pb-28 pt-14 md:pt-20">
      <article className="mx-auto flex max-w-[720px] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="eyebrow">Plain English</span>
          <h1 className="headline text-[44px] md:text-[56px]">Privacy</h1>
          <p className="text-mute">
            {site.name} is run by {site.instructor.name}, a flight instructor in {site.instructor.location}. Here&apos;s exactly what the site keeps and why.
          </p>
        </div>
        {sections.map(([title, body]) => (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <p className="leading-relaxed text-mute">{body}</p>
          </section>
        ))}
        <p className="text-[14px] text-dim">
          See also the{" "}
          <Link href="/leaderboard/rules" className="link">
            contest rules
          </Link>
          .
        </p>
      </article>
    </main>
  );
}
