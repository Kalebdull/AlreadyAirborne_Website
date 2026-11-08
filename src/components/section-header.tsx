// Every section opens the same way: small label, big headline, intro.
export function SectionHeader({
  eyebrow,
  title,
  intro,
  tone = "text-cyan",
  align = "center",
  rule = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  tone?: string;
  align?: "center" | "left";
  rule?: boolean;
}) {
  const center = align === "center";
  return (
    <div className={`reveal flex flex-col gap-3 md:gap-4 ${center ? "mx-auto max-w-3xl items-center text-center" : "max-w-2xl"}`}>
      <span className={`eyebrow ${tone}`}>{eyebrow}</span>
      <h2 className="headline text-[36px] md:text-[52px]">{title}</h2>
      {rule && <span aria-hidden className="accent-rule my-1" />}
      {intro && <p className={`text-[17px] leading-relaxed text-mute md:text-lg ${center ? "max-w-xl" : ""}`}>{intro}</p>}
    </div>
  );
}
