import { useId } from "react";

// The AlreadyAirborne "A": a peak, a swept wing across it, and two legs.
// Traced from design/brand/logo-a.png. Shapes overlap on purpose (the peak
// tucks under the wing), so it relies on the default nonzero fill rule.
export const LOGO_PATHS = [
  "M628 400L770 630H704L628 505L552 630H486Z",
  "M296 555C330 568 350 590 372 602L628 642L884 602C906 590 926 568 960 555C944 592 916 622 876 630L826 652L842 668L790 662L628 690L466 662L414 668L430 652L380 630C340 622 312 592 296 555Z",
  "M471 674H533L460 808H385Z",
  "M723 674H785L871 808H796Z",
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
