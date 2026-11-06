// The flight path marker: where the airplane is actually going.
export function LogoMark({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={(size * 20) / 34}
      viewBox="0 0 34 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
      className={className ?? "text-green"}
    >
      <circle cx="17" cy="11" r="5" />
      <line x1="2" y1="11" x2="12" y2="11" />
      <line x1="22" y1="11" x2="32" y2="11" />
      <line x1="17" y1="1" x2="17" y2="6" />
    </svg>
  );
}
