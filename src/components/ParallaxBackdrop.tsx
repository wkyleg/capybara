/** Programmatic tropical layers behind the runner canvas (no bitmap assets). */

interface ParallaxBackdropProps {
  distPx: number;
  calm: number;
  arousal: number;
  className?: string;
}

export function ParallaxBackdrop({ distPx, calm, arousal, className = '' }: ParallaxBackdropProps) {
  const scroll = distPx * 0.08;
  const mid = distPx * 0.14;
  const near = distPx * 0.22;
  const hueShift = (arousal - calm) * 18;

  return (
    <svg
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <title>Decorative jungle parallax</title>
      <defs>
        <linearGradient id="pb-sky" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={`hsl(${168 + hueShift} 42% 12%)`} />
          <stop offset="55%" stopColor={`hsl(${152 + hueShift * 0.5} 36% 9%)`} />
          <stop offset="100%" stopColor={`hsl(${200 + hueShift * 0.3} 32% 7%)`} />
        </linearGradient>
        <linearGradient id="pb-glow" x1="70%" y1="0%" x2="30%" y2="80%">
          <stop offset="0%" stopColor="rgba(251, 146, 60, 0.14)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#pb-sky)" />
      <rect width="800" height="450" fill="url(#pb-glow)" />

      <g opacity={0.35} transform={`translate(${-((scroll * 0.15) % 200) - 100}, 0)`}>
        <path d="M0 280 Q200 220 400 260 T800 240 L800 450 L0 450 Z" fill="rgba(20, 90, 70, 0.45)" />
        <path d="M-80 300 Q120 250 320 290 T720 270 L800 450 L-80 450 Z" fill="rgba(15, 70, 55, 0.35)" />
      </g>

      <g opacity={0.5} transform={`translate(${-((mid * 0.2) % 160)}, 0)`}>
        <ellipse cx="120" cy="200" rx="90" ry="40" fill="rgba(34, 120, 85, 0.25)" />
        <ellipse cx="380" cy="185" rx="110" ry="48" fill="rgba(28, 100, 72, 0.28)" />
        <ellipse cx="620" cy="195" rx="95" ry="42" fill="rgba(30, 110, 78, 0.26)" />
      </g>

      <g opacity={0.4} transform={`translate(${-((near * 0.35) % 120)}, 0)`}>
        <path
          d="M40 120 Q60 40 100 100 Q140 20 180 110 Q220 50 260 115 L260 450 L40 450 Z"
          fill="rgba(45, 95, 62, 0.35)"
        />
        <path
          d="M520 130 Q540 55 580 115 Q630 35 680 125 Q720 70 760 130 L780 450 L500 450 Z"
          fill="rgba(38, 88, 58, 0.32)"
        />
      </g>
    </svg>
  );
}
