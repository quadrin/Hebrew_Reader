/* The path's three landmarks, drawn rather than borrowed from an icon set: a
   trophy for the end of a section, a chest for the reward inside a unit, and
   a gate for a checkpoint. Flat two-tone shapes in the theme's own gold, so
   they read from across the screen the way the discs do; `muted` is the
   same drawing in grey, for the one not reached yet. */

const gold = (muted) => (muted ? "var(--d-mute-deep, color-mix(in srgb, var(--d-sub) 35%, var(--d-mute)))" : "var(--d-gold)");
const dark = (muted) => (muted ? "color-mix(in srgb, var(--d-sub) 55%, var(--d-mute))" : "var(--d-gold-dark)");
const ink = "var(--d-on-fill)";
const paper = "var(--d-card)";

export function TrophyArt({ size = 56, muted = false, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* handles */}
      <path d="M14 16h-5a4 4 0 0 0-4 4c0 8 6 14 14 15v-6c-4-1-8-4-8-9v-4z" fill={dark(muted)} />
      <path d="M50 16h5a4 4 0 0 1 4 4c0 8-6 14-14 15v-6c4-1 8-4 8-9v-4z" fill={dark(muted)} />
      {/* cup */}
      <path d="M16 8h32v16c0 10-7 18-16 18S16 34 16 24V8z" fill={gold(muted)} />
      <path d="M16 8h32v5H16z" fill={dark(muted)} opacity=".35" />
      {/* star */}
      <path d="M32 17l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L32 30.3 26.7 33l1.1-5.8-4.3-4.1 5.9-.8z" fill={paper} />
      {/* stem and base */}
      <path d="M28 42h8v6h-8z" fill={dark(muted)} />
      <path d="M20 48h24a3 3 0 0 1 3 3v4H17v-4a3 3 0 0 1 3-3z" fill={ink} opacity=".85" />
      <path d="M20 48h24a3 3 0 0 1 3 3H17a3 3 0 0 1 3-3z" fill={dark(muted)} />
    </svg>
  );
}

export function ChestArt({ size = 64, muted = false, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* coins spilling over the rim */}
      <circle cx="22" cy="24" r="5" fill={gold(muted)} />
      <circle cx="42" cy="22" r="5" fill={gold(muted)} />
      <circle cx="32" cy="20" r="6" fill={dark(muted)} />
      {/* lid, thrown back */}
      <path d="M8 28a8 8 0 0 1 8-8h32a8 8 0 0 1 8 8v4H8v-4z" fill={dark(muted)} />
      <path d="M8 26h48v6H8z" fill={ink} opacity=".18" />
      {/* body */}
      <path d="M8 32h48v18a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V32z" fill={gold(muted)} />
      <path d="M8 32h48v5H8z" fill={dark(muted)} opacity=".4" />
      {/* straps */}
      <path d="M18 32h4v22h-4zM42 32h4v22h-4z" fill={dark(muted)} />
      {/* lock plate and keyhole */}
      <rect x="27" y="33" width="10" height="12" rx="2" fill={ink} opacity=".85" />
      <circle cx="32" cy="38" r="2" fill={paper} />
      <path d="M31 38h2v4h-2z" fill={paper} />
    </svg>
  );
}

export function GateArt({ size = 48, muted = false, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* flag */}
      <path d="M31 6h2v14h-2z" fill={dark(muted)} />
      <path d="M33 6h12l-3 4 3 4H33z" fill={muted ? dark(muted) : "var(--d-red)"} />
      {/* towers with battlements */}
      <path d="M6 22h4v-4h4v4h4v-4h4v4h2v34H6V22z" fill={gold(muted)} />
      <path d="M40 22h2v-4h4v4h4v-4h4v4h4v34H40V22z" fill={gold(muted)} />
      {/* wall and arch */}
      <path d="M22 30h20v26H22z" fill={dark(muted)} />
      <path d="M26 56V44a6 6 0 0 1 12 0v12z" fill={ink} opacity=".85" />
      {/* tower windows */}
      <rect x="12" y="30" width="4" height="7" rx="2" fill={ink} opacity=".7" />
      <rect x="48" y="30" width="4" height="7" rx="2" fill={ink} opacity=".7" />
      {/* ground */}
      <path d="M4 56h56v3H4z" fill={dark(muted)} />
    </svg>
  );
}
