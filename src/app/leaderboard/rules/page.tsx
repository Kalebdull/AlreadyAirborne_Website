import type { Metadata } from "next";
import { getContest } from "@/lib/leaderboard";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contest rules" };

export default async function RulesPage() {
  const { contest } = await getContest();
  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short", timeZone: site.timezone }) + " PT" : "[DATE]";

  const sections: [string, React.ReactNode][] = [
    [
      "1. Sponsor",
      <>
        This contest is run by {site.instructor.name} (&ldquo;AlreadyAirborne&rdquo;), {site.email}. It is not sponsored, endorsed or administered by, or associated
        with, Instagram or Meta.
      </>,
    ],
    ["2. No purchase necessary", "No purchase or payment of any kind is required to enter or win. A purchase does not improve your chances."],
    [
      "3. Eligibility",
      "Open to legal residents of the 50 United States and D.C. who are 18 or older at the time of entry. Void where prohibited. The sponsor and the sponsor's immediate family and household members are not eligible. The sponsor's own score may appear on the leaderboard for fun but can't win.",
    ],
    [
      "4. Contest period",
      <>
        {contest ? `“${contest.title}” ` : ""}starts {fmt(contest?.starts_at)} and ends {fmt(contest?.ends_at)}. Entries must be submitted before the end time.
      </>,
    ],
    [
      "5. How to enter",
      "Fly the flight game on this website by hand from the takeoff roll through a landing, then submit your score with a callsign and a valid email address. One entry per person and email address; if you submit again, your highest verified score is kept. Entries using automation, scripts, bots, modified game code or multiple identities will be disqualified.",
    ],
    [
      "6. Winner selection",
      "This is a contest of skill, not chance. Every score is verified by re-flying the recorded control inputs on our server. The eligible entrant with the highest verified score at the end of the contest period wins. Ties go to the score submitted first. The sponsor may review any entry and disqualify scores it reasonably believes were not achieved fairly.",
    ],
    [
      "7. Prize",
      <>
        One prize: {contest?.prize ?? "[PRIZE]"}. Approximate retail value: $50. No cash alternative. The prize is not transferable and must be scheduled within 90 days of the winner
        accepting it.
      </>,
    ],
    [
      "8. Winner notification",
      "The winner will be contacted at the email address submitted within 7 days after the contest ends and must respond within 7 days, or an alternate winner (the next highest verified score) may be selected.",
    ],
    [
      "9. Privacy",
      "Your callsign and score are shown publicly. Your email is private and used only to verify entries and contact the winner, and to send you tips and updates only if you opted in. You can ask us to delete your entry at any time.",
    ],
    ["10. General", "The sponsor may modify, suspend or cancel the contest if it cannot run as planned (for example, due to cheating or technical failure)."],
  ];

  return (
    <main className="px-6 pb-28 pt-14 md:pt-20">
      <article className="mx-auto flex max-w-[720px] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <span className="eyebrow">Official rules</span>
          <h1 className="headline text-[44px] md:text-[56px]">Contest rules</h1>
        </div>
        {sections.map(([title, body]) => (
          <section key={title} className="flex flex-col gap-2">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <p className="leading-relaxed text-mute">{body}</p>
          </section>
        ))}
      </article>
    </main>
  );
}
