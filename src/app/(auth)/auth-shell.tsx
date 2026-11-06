import { LogoMark } from "@/components/logo";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-start justify-center px-6 py-16 md:py-24">
      <div className="flex w-full max-w-[420px] flex-col gap-8">
        <div className="flex flex-col gap-4">
          <LogoMark size={40} />
          <span className="eyebrow">{eyebrow}</span>
          <h1 className="headline text-[44px] md:text-[52px]">{title}</h1>
          {subtitle && <p className="text-lg text-mute">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="border-t border-line pt-6 text-[15px] text-mute">{footer}</div>}
      </div>
    </main>
  );
}
