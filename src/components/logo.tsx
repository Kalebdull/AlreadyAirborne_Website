import { useId } from "react";

// The AlreadyAirborne "A": a thin A with a swept wing across it. A simplified
// take on design/brand/logo-a.png. The two shapes overlap where the wing
// crosses the legs.
export const LOGO_PATHS = [
  "M628 400L880 808H836L628 471L420 808H376Z",
  "M300 556C420 596 524 622 628 636C732 622 836 596 956 556C840 610 736 646 628 660C520 646 416 610 300 556Z",
];
export const LOGO_VIEWBOX = "296 400 664 408";
const ASPECT = 408 / 664;

export function LogoMark({ size = 26, className, glow = false }: { size?: number; className?: string; glow?: boolean }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={Math.round(size * ASPECT * 100) / 100}
      viewBox={LOGO_VIEWBOX}
      aria-hidden="true"
      className={className}
      style={glow ? { filter: "drop-shadow(0 0 6px rgba(80,150,255,.55))" } : undefined}
    >
      <defs>
        <linearGradient id={`${id}-silver`} x1="0" y1="400" x2="0" y2="808" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.55" stopColor="#d9e1ec" />
          <stop offset="1" stopColor="#aeb9c9" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id}-silver)`}>
        {LOGO_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

// The game's flight path marker: an instrument symbol (where the airplane is
// actually going), not the brand mark.
export function FlightPathMarker({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={(size * 20) / 34} viewBox="0 0 34 20" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true" className={className}>
      <circle cx="17" cy="11" r="5" />
      <line x1="2" y1="11" x2="12" y2="11" />
      <line x1="22" y1="11" x2="32" y2="11" />
      <line x1="17" y1="1" x2="17" y2="6" />
    </svg>
  );
}
