/**
 * Hand-drawn geometric illustrations.
 *
 * Flat colour, no gradients, no strokes except where a line is the subject.
 * The idiom is mid-century reductive illustration — Paul Rand, Charley Harper,
 * Alvin Lustig: say the thing with three shapes and stop.
 *
 * Every illustration draws only from the palette in globals.css, so the set
 * reads as one hand.
 */

type ArtProps = {
  className?: string;
  accent?: string;
};

/* -------------------------------------------------------------------------
   Monogram — a portico reduced to its geometry.
   Four columns under a shallow pediment: the original mark's proportions,
   redrawn to hold up at 24px.
   ------------------------------------------------------------------------- */

export function Monogram({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 60 56"
      className={className}
      role="img"
      aria-label="Law Offices of Jerry Wang"
      fill="currentColor"
    >
      {/* Pediment */}
      <path d="M30 2 L57 16.5 L3 16.5 Z" />
      {/* Architrave */}
      <rect x="3" y="19.5" width="54" height="3.6" />
      {/* Columns */}
      <rect x="7" y="26" width="7.5" height="21" />
      <rect x="19.6" y="26" width="7.5" height="21" />
      <rect x="32.2" y="26" width="7.5" height="21" />
      <rect x="44.8" y="26" width="7.5" height="21" />
      {/* Stylobate */}
      <rect x="3" y="50" width="54" height="4" />
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Arcade — the recurring structural motif.
   A brass line-drawing of an arched colonnade. Mid-century civic architecture
   borrowed the arcade from the classical courthouse and stripped its
   ornament; this is that gesture, in one weight of line.
   ------------------------------------------------------------------------- */

export function Arcade({
  className,
  bays = 7,
  stroke = "var(--ochre-lt)",
}: ArtProps & { bays?: number; stroke?: string }) {
  const w = 100;
  const h = 46;
  const bayW = w / bays;
  const springLine = 22;

  const arches = Array.from({ length: bays }, (_, i) => {
    const x = i * bayW;
    const r = bayW / 2;
    return (
      <path
        key={i}
        d={`M ${x} ${h} L ${x} ${springLine} A ${r} ${r} 0 0 1 ${x + bayW} ${springLine} L ${x + bayW} ${h}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    );
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {arches}
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Hero — a portico dissolved into pure geometry.
   A brass sun disc behind a brass-line arcade, on the green field.
   ------------------------------------------------------------------------- */

export function HeroArt({ className }: ArtProps) {
  const bays = 5;
  const left = 16;
  const right = 504;
  const bayW = (right - left) / bays;
  const spring = 210;
  const base = 352;

  return (
    <svg
      viewBox="0 0 520 400"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Sun disc, run off two edges of the frame. A mid-century poster
          crops its largest shape rather than centring it politely. */}
      <circle cx="436" cy="168" r="150" fill="var(--ochre)" opacity="0.94" />

      {/* Horizon */}
      <line
        x1="0"
        y1="210"
        x2="520"
        y2="210"
        stroke="var(--ochre-lt)"
        strokeWidth="1"
        opacity="0.5"
      />

      {/* Arcade */}
      {Array.from({ length: bays }, (_, i) => {
        const x = left + i * bayW;
        const r = bayW / 2;
        return (
          <path
            key={i}
            d={`M ${x} ${base} L ${x} ${spring} A ${r} ${r} 0 0 1 ${x + bayW} ${spring} L ${x + bayW} ${base}`}
            fill="none"
            stroke="var(--paper)"
            strokeWidth="3"
          />
        );
      })}

      {/* Stylobate — the long horizontal the whole composition rests on */}
      <rect x="0" y="352" width="520" height="8" fill="var(--paper)" />
      <rect
        x="0"
        y="368"
        width="520"
        height="2"
        fill="var(--ochre-lt)"
        opacity="0.6"
      />
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Practice-area illustrations — 120 x 120, three colours each.
   ------------------------------------------------------------------------- */

function Frame({
  children,
  className,
  accent,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={accent ? ({ "--art-accent": accent } as React.CSSProperties) : undefined}
    >
      {children}
    </svg>
  );
}

/** The practice area's own colour, with a sober fallback. */
const A = "var(--art-accent, var(--walnut))";

/** Business Law — a skyline against a low sun. */
function BusinessArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <circle cx="86" cy="38" r="25" fill="var(--ochre)" />
      <rect x="16" y="52" width="24" height="52" fill={A} />
      <rect x="45" y="32" width="26" height="72" fill="var(--teak)" />
      <rect x="76" y="64" width="24" height="40" fill={A} />
      <g fill="var(--paper)" opacity="0.55">
        <rect x="49" y="42" width="18" height="2" />
        <rect x="49" y="52" width="18" height="2" />
        <rect x="49" y="62" width="18" height="2" />
        <rect x="49" y="72" width="18" height="2" />
      </g>
      <rect x="8" y="104" width="104" height="4" fill="var(--ink)" />
    </Frame>
  );
}

/** Civil Litigation — scales, caught mid-decision. */
function LitigationArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <rect x="57" y="26" width="6" height="74" fill={A} />
      <rect x="38" y="100" width="44" height="6" fill={A} />
      <circle cx="60" cy="22" r="6" fill="var(--ochre)" />
      <g transform="rotate(-8 60 36)">
        <rect x="14" y="33" width="92" height="5" fill="var(--ochre)" />
        <line x1="20" y1="38" x2="20" y2="54" stroke="var(--ink)" strokeWidth="1.5" />
        <line x1="100" y1="38" x2="100" y2="70" stroke="var(--ink)" strokeWidth="1.5" />
        <path d="M6 54 A 14 14 0 0 0 34 54 Z" fill="var(--ink)" />
        <path d="M86 70 A 14 14 0 0 0 114 70 Z" fill="var(--ink)" />
      </g>
    </Frame>
  );
}

/** Personal Injury — what was broken, bound back together. */
function InjuryArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <rect x="8" y="48" width="42" height="22" fill={A} />
      <rect x="70" y="48" width="42" height="22" fill={A} />
      <rect x="44" y="36" width="32" height="46" fill="var(--ochre)" />
      <rect x="8" y="100" width="104" height="4" fill="var(--ink)" />
    </Frame>
  );
}

/** Divorce & Family Law — three figures, in the Girard manner. */
function FamilyArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <circle cx="30" cy="44" r="11" fill={A} />
      <path d="M18 100 L23 58 L37 58 L42 100 Z" fill={A} />
      <circle cx="90" cy="44" r="11" fill="var(--ochre)" />
      <path d="M78 100 L83 58 L97 58 L102 100 Z" fill="var(--ochre)" />
      <circle cx="60" cy="64" r="8" fill="var(--persimmon)" />
      <path d="M51 100 L55 75 L65 75 L69 100 Z" fill="var(--persimmon)" />
      <rect x="8" y="100" width="104" height="4" fill="var(--ink)" />
    </Frame>
  );
}

/** Prenuptial Agreements — two rings, and the paper that describes them. */
function PrenuptialArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <circle cx="47" cy="46" r="26" fill="none" stroke={A} strokeWidth="6" />
      <circle cx="75" cy="46" r="26" fill="none" stroke="var(--ochre)" strokeWidth="6" />
      <g fill="var(--ink)" opacity="0.75">
        <rect x="22" y="92" width="76" height="4" />
        <rect x="22" y="102" width="76" height="4" />
        <rect x="22" y="112" width="44" height="4" />
      </g>
    </Frame>
  );
}

/** Real Estate Law — the A-frame, mid-century's own house. */
function RealEstateArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <circle cx="26" cy="26" r="12" fill="var(--teak)" />
      <path d="M62 12 L108 100 L16 100 Z" fill={A} />
      <path d="M62 44 L91 100 L33 100 Z" fill="var(--paper)" />
      <rect x="53" y="74" width="18" height="26" fill="var(--walnut)" />
      <rect x="8" y="100" width="104" height="4" fill="var(--ink)" />
    </Frame>
  );
}

/** Criminal Law — a shield, banded. */
function CriminalArt(p: ArtProps) {
  return (
    <Frame {...p}>
      <path
        d="M22 16 H98 V58 C98 82 82 99 60 108 C38 99 22 82 22 58 Z"
        fill={A}
      />
      <rect x="22" y="52" width="76" height="9" fill="var(--ochre)" />
      <path
        d="M22 16 H98 V58 C98 82 82 99 60 108 C38 99 22 82 22 58 Z"
        fill="none"
        stroke="var(--ink)"
        strokeWidth="2"
      />
    </Frame>
  );
}

const ART = {
  business: BusinessArt,
  litigation: LitigationArt,
  injury: InjuryArt,
  family: FamilyArt,
  prenuptial: PrenuptialArt,
  realestate: RealEstateArt,
  criminal: CriminalArt,
} as const;

export function PracticeArt({
  art,
  accent,
  className,
}: {
  art: string;
  accent?: string;
  className?: string;
}) {
  const Component = ART[art as keyof typeof ART] ?? BusinessArt;
  return <Component className={className} accent={accent} />;
}


/* -------------------------------------------------------------------------
   The waiting room.

   Drawn from the firm's own office rather than invented: the pair of black
   swivel chairs, the glass side table, the floor-to-ceiling vertical blinds,
   the dracaena in a terracotta pot. Those chairs are mid-century by
   accident — they were already in the room. No photograph is used; this is
   the room, drawn.
   ------------------------------------------------------------------------- */

const SCENE_W = 980;
const SCENE_H = 380;
const FLOOR = 262;

function Chair({
  x,
  y,
  scale,
  flip = false,
}: {
  x: number;
  y: number;
  scale: number;
  flip?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      <ellipse cx="0" cy="80" rx="74" ry="11" fill="var(--ink)" opacity="0.18" />
      <path
        d="M -66 -4 C -75 -62 -47 -88 0 -88 C 47 -88 75 -62 66 -4 C 66 15 41 27 0 27 C -41 27 -66 15 -66 -4 Z"
        fill="var(--ink)"
      />
      {/* light rolling off the shoulder, so the shell reads as leather */}
      <path
        d="M -56 -34 C -58 -66 -34 -80 -4 -80"
        fill="none"
        stroke="#5c4536"
        strokeWidth="7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M -55 -6 C -55 -22 -31 -32 0 -32 C 31 -32 55 -22 55 -6 C 55 8 31 18 0 18 C -31 18 -55 8 -55 -6 Z"
        fill="#3d2b20"
      />
      <ellipse cx="0" cy="-2" rx="43" ry="11" fill="#16100b" opacity="0.5" />
      <path d="M -8 27 L 8 27 L 5.5 56 L -5.5 56 Z" fill="#9c9488" />
      <g stroke="#b3ab9d" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M0 56 L -52 72" />
        <path d="M0 56 L -20 80" />
        <path d="M0 56 L 20 80" />
        <path d="M0 56 L 52 72" />
      </g>
      <ellipse cx="0" cy="56" rx="10" ry="3.6" fill="#c4bcae" />
    </g>
  );
}

/** Blades that arc out and fall, rather than spikes radiating from a point. */
const BLADES: Array<[number, number, number, number]> = [
  [-96, 132, 15, 0.55],
  [-70, 150, 17, 0.5],
  [-44, 126, 14, 0.62],
  [-16, 156, 16, 0.42],
  [10, 138, 15, 0.5],
  [36, 158, 17, 0.45],
  [62, 130, 14, 0.6],
  [88, 144, 16, 0.55],
  [108, 116, 13, 0.68],
  [-114, 112, 13, 0.66],
];
const GREENS = ["#44552c", "#6b6b39", "#3a4d30", "#55632f"];

function Dracaena({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      {BLADES.map(([deg, length, width, droop], i) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const tipX = cx + length * Math.cos(a);
        const tipY = cy + length * Math.sin(a) + length * droop * 0.55;
        const mx = cx + (tipX - cx) * 0.5;
        const my = cy + (tipY - cy) * 0.5 - length * 0.16;
        const px = -Math.sin(a) * width;
        const py = Math.cos(a) * width;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} Q ${mx + px * 0.5} ${my + py * 0.5} ${tipX} ${tipY} Q ${mx - px * 0.6} ${my - py * 0.6} ${cx} ${cy} Z`}
            fill={GREENS[i % GREENS.length]}
          />
        );
      })}
    </>
  );
}

export function OfficeScene({ className }: ArtProps) {
  const bays = 30;
  const slatW = SCENE_W / bays;

  return (
    <svg
      viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
      className={className}
      role="img"
      aria-label="The firm's waiting room: two black swivel chairs either side of a glass side table, against floor-to-ceiling vertical blinds, with a dracaena in a terracotta pot."
    >
      <defs>
        <linearGradient id="jw-fall" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
          <stop offset="0.6" stopColor="#241811" stopOpacity="0.05" />
          <stop offset="1" stopColor="#241811" stopOpacity="0.2" />
        </linearGradient>
        <radialGradient id="jw-warm" cx="0.26" cy="0.12" r="0.75">
          <stop offset="0" stopColor="#d19b33" stopOpacity="0.3" />
          <stop offset="1" stopColor="#d19b33" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={SCENE_W} height={SCENE_H} fill="var(--paper)" />

      {/* Blinds. Brightness swings in broad bands so the light reads as
          raking across the slats instead of an even stripe. */}
      {Array.from({ length: bays }, (_, i) => {
        const u = i / (bays - 1);
        const glow = Math.pow(0.5 + 0.5 * Math.sin(u * Math.PI * 2.4 - 0.6), 1.6);
        return (
          <g key={i}>
            <rect
              x={i * slatW}
              y={12}
              width={slatW}
              height={FLOOR - 12}
              fill={i % 2 === 0 ? "#efe7d8" : "#e2d6be"}
            />
            <rect
              x={i * slatW}
              y={12}
              width={slatW}
              height={FLOOR - 12}
              fill="#f6e9c8"
              opacity={glow * 0.75}
            />
          </g>
        );
      })}

      <rect x="0" y="12" width={SCENE_W} height={FLOOR - 12} fill="url(#jw-fall)" />
      <rect x="0" y="12" width={SCENE_W} height={FLOOR - 12} fill="url(#jw-warm)" />
      <rect x="0" y="0" width={SCENE_W} height="12" fill="#c6b9a1" />

      {/* the pull cord */}
      <line x1="760" y1="12" x2="760" y2="132" stroke="#b6ab99" strokeWidth="2" />
      <circle cx="760" cy="136" r="4" fill="#b6ab99" />

      <rect x="0" y={FLOOR} width={SCENE_W} height={SCENE_H - FLOOR} fill="#8f8477" />
      <rect x="0" y={FLOOR - 6} width={SCENE_W} height="6" fill="#6b6255" />
      <path
        d={`M0 ${FLOOR} L${SCENE_W} ${FLOOR} L${SCENE_W} ${FLOOR + 44} L0 ${FLOOR + 62} Z`}
        fill="#f6e9c8"
        opacity="0.1"
      />

      <Chair x={286} y={FLOOR - 14} scale={1.2} />
      <Chair x={586} y={FLOOR - 8} scale={1.26} flip />

      <g transform={`translate(436 ${FLOOR - 78})`}>
        <ellipse cx="6" cy="92" rx="40" ry="7" fill="var(--ink)" opacity="0.14" />
        <ellipse cx="0" cy="0" rx="44" ry="12" fill="var(--ochre-lt)" opacity="0.8" />
        <ellipse cx="0" cy="0" rx="44" ry="12" fill="none" stroke="#b3ab9d" strokeWidth="3" />
        <g stroke="#b3ab9d" strokeWidth="3.5" strokeLinecap="round">
          <path d="M -27 7 L -34 84" />
          <path d="M 27 7 L 34 84" />
          <path d="M 0 11 L 0 88" />
        </g>
      </g>

      <g transform={`translate(856 ${FLOOR + 34})`}>
        <ellipse cx="0" cy="24" rx="46" ry="8" fill="var(--ink)" opacity="0.16" />
        <Dracaena cx={0} cy={-104} />
        <rect x="-4" y="-104" width="8" height="66" fill="#6b4a2c" />
        <path d="M -34 -42 L 34 -42 L 25 22 L -25 22 Z" fill="var(--cognac)" />
        <rect x="-38" y="-49" width="76" height="11" fill="#8a4a20" />
      </g>
    </svg>
  );
}

/* -------------------------------------------------------------------------
   Small marks used in the interface.
   ------------------------------------------------------------------------- */

export function PhoneMark({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 3h4l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

export function MailMark({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.5" y="5" width="19" height="14" />
      <path d="m2.5 6 9.5 7 9.5-7" />
    </svg>
  );
}

export function PinMark({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 21c4.5-5 7-8.4 7-11.5a7 7 0 1 0-14 0C5 12.6 7.5 16 12 21Z" />
      <circle cx="12" cy="9.5" r="2.6" />
    </svg>
  );
}

export function ArrowMark({ className }: ArtProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}
