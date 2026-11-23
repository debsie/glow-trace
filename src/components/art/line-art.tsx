import type { CSSProperties, ReactElement } from "react";

/**
 * Glowtrace line art: single-weight strokes in theme tokens that draw themselves once (and stay
 * still under reduced motion). One motif per subject, so guides and programmes read at a glance.
 */
export type Motif =
  | "face"
  | "sun"
  | "drop"
  | "eye"
  | "spots"
  | "strands"
  | "coil"
  | "braid"
  | "comb"
  | "nail"
  | "hand"
  | "flask"
  | "shield"
  | "chart"
  | "leaf"
  | "lips";

const P = ({ d, delay = 0, accent = false }: { d: string; delay?: number; accent?: boolean }) => (
  <path
    d={d}
    pathLength={1}
    data-draw=""
    className={accent ? "text-primary" : "text-foreground"}
    style={{ "--art-delay": `${delay}ms` } as CSSProperties}
  />
);

const C = ({
  cx,
  cy,
  r,
  delay = 0,
  accent = false,
}: {
  cx: number;
  cy: number;
  r: number;
  delay?: number;
  accent?: boolean;
}) => (
  <circle
    cx={cx}
    cy={cy}
    r={r}
    pathLength={1}
    data-draw=""
    className={accent ? "text-primary" : "text-foreground"}
    style={{ "--art-delay": `${delay}ms` } as CSSProperties}
  />
);

const MOTIFS: Record<Motif, ReactElement> = {
  face: (
    <>
      <P d="M60 18c-20 0-32 16-32 38 0 26 16 44 32 44s32-18 32-44c0-22-12-38-32-38Z" />
      <P d="M46 52c3-3 8-3 11 0M63 52c3-3 8-3 11 0" delay={500} />
      <P d="M52 78c5 4 11 4 16 0" delay={700} accent />
      <g className="art-breathe">
        <C cx={42} cy={66} r={4} delay={900} accent />
        <C cx={78} cy={66} r={4} delay={950} accent />
      </g>
    </>
  ),
  sun: (
    <>
      <g className="art-breathe">
        <C cx={60} cy={60} r={18} accent />
      </g>
      <g className="art-orbit">
        <P
          d="M60 22v-8M60 106v-8M22 60h-8M106 60h-8M33 33l-6-6M93 93l-6-6M33 87l-6 6M93 27l-6 6"
          delay={400}
        />
      </g>
    </>
  ),
  drop: (
    <>
      <P d="M60 16C48 36 34 52 34 70a26 26 0 0 0 52 0c0-18-14-34-26-54Z" />
      <P d="M46 74c5 5 9 5 14 0s9-5 14 0" delay={600} accent />
    </>
  ),
  eye: (
    <>
      <P d="M18 60c12-18 26-26 42-26s30 8 42 26c-12 18-26 26-42 26S30 78 18 60Z" />
      <g className="art-breathe">
        <C cx={60} cy={60} r={11} delay={500} accent />
      </g>
      <P d="M38 92c14 6 30 6 44 0" delay={800} accent />
    </>
  ),
  spots: (
    <>
      <P d="M24 30c22-10 50-10 72 0v52c-22 10-50 10-72 0Z" />
      <C cx={46} cy={50} r={4} delay={500} accent />
      <C cx={70} cy={44} r={3} delay={600} accent />
      <C cx={62} cy={68} r={5} delay={700} accent />
      <C cx={40} cy={72} r={2.5} delay={800} accent />
    </>
  ),
  strands: (
    <>
      <P d="M36 14c-8 24 10 40 2 64-4 12-2 20 4 28" />
      <P d="M56 12c-8 24 10 42 2 66-4 12-2 20 4 28" delay={200} accent />
      <P d="M76 14c-8 24 10 40 2 64-4 12-2 20 4 28" delay={400} />
    </>
  ),
  coil: (
    <>
      <P
        d="M60 14c14 0 14 12 0 12s-14 12 0 12 14 12 0 12-14 12 0 12 14 12 0 12-14 12 0 12 14 12 0 12"
        accent
      />
      <P d="M30 104h60" delay={900} />
    </>
  ),
  braid: (
    <>
      <P d="M48 14c24 12 24 22 0 34s-24 22 0 34 24 22 0 26" />
      <P d="M72 14c-24 12-24 22 0 34s24 22 0 34-24 22 0 26" delay={300} accent />
    </>
  ),
  comb: (
    <>
      <P d="M22 46h76v12H22Z" />
      <P d="M28 58v28M38 58v28M48 58v28M58 58v28M68 58v28M78 58v28M88 58v28" delay={400} />
      <P d="M30 30c20-10 40-10 60 0" delay={700} accent />
    </>
  ),
  nail: (
    <>
      <P d="M38 104V52c0-18 10-30 22-30s22 12 22 30v52" />
      <P d="M44 50c0-12 7-20 16-20s16 8 16 20v10H44Z" delay={500} accent />
      <P d="M48 72v24M60 72v24M72 72v24" delay={800} />
    </>
  ),
  hand: (
    <>
      <P d="M40 104V62M40 62V30a6 6 0 0 1 12 0v30M52 58V22a6 6 0 0 1 12 0v36M64 58V28a6 6 0 0 1 12 0v32M76 62V40a6 6 0 0 1 12 0v32c0 18-12 32-28 32H52" />
      <P d="M46 28h0M58 20h0M70 26h0M82 38h0" delay={700} accent />
      <P d="M40 70c-8-8-18-6-18 2 0 6 10 16 18 22" delay={400} />
    </>
  ),
  flask: (
    <>
      <P d="M48 16h24M52 16v26L30 92a8 8 0 0 0 7 12h46a8 8 0 0 0 7-12L68 42V16" />
      <P d="M38 80c8-4 14 4 22 0s14 4 22 0" delay={600} accent />
      <g className="art-breathe">
        <C cx={56} cy={92} r={3} delay={900} accent />
        <C cx={68} cy={88} r={2} delay={1000} accent />
      </g>
    </>
  ),
  shield: (
    <>
      <P d="M60 14l34 12v26c0 24-14 42-34 52-20-10-34-28-34-52V26Z" />
      <P d="M46 60l10 10 20-22" delay={700} accent />
    </>
  ),
  chart: (
    <>
      <P d="M20 96h80M20 96V20" />
      <P d="M26 80l18-12 16 6 18-24 18-8" delay={400} accent />
      <C cx={78} cy={50} r={3.5} delay={1100} accent />
    </>
  ),
  leaf: (
    <>
      <P d="M28 92C28 52 52 26 94 22c-2 42-28 70-66 70Z" />
      <P d="M28 92c18-18 36-36 54-54" delay={600} accent />
    </>
  ),
  lips: (
    <>
      <P d="M18 60c10-14 22-20 30-14 6-6 18-6 24 0 8-6 20 0 30 14-14 18-28 26-42 26S32 78 18 60Z" />
      <P d="M18 60c14 4 28 6 42 6s28-2 42-6" delay={600} accent />
    </>
  ),
};

/** A motif in a square; `size` is the CSS size class. Decorative: hidden from assistive tech. */
export const LineArt = ({
  motif,
  className = "h-24 w-24",
}: {
  motif: Motif;
  className?: string;
}) => (
  <svg
    viewBox="0 0 120 120"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`art-draw ${className}`}
    aria-hidden="true"
  >
    {MOTIFS[motif]}
  </svg>
);
