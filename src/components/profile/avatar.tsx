import type { AvatarArt, AvatarChoice } from "@/lib/profile";
import { initialsOf } from "@/lib/profile";

import { useProfilePhoto } from "./use-profile";

/** Hair drawn behind the face (back) and over it (front), on a 64 x 64 box. */
const HAIR: Record<AvatarArt, { back?: string; front?: string }> = {
  afro: { back: "M32 6c13 0 22 9 22 21 0 7-3 12-6 15H16c-3-3-6-8-6-15C10 15 19 6 32 6Z" },
  braids: {
    back: "M18 26c0-10 6-16 14-16s14 6 14 16v28h-5V30H23v24h-5Z",
    front: "M19 27c2-8 7-12 13-12s11 4 13 12c-6-4-20-4-26 0Z",
  },
  locs: {
    back: "M17 26c0-10 7-16 15-16s15 6 15 16l2 22h-4l-2-18-2 20h-3V28H26v22h-3l-2-20-2 18h-4Z",
    front: "M19 27c2-8 7-12 13-12s11 4 13 12c-6-4-20-4-26 0Z",
  },
  bun: {
    back: "M32 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z",
    front: "M18 30c1-10 7-16 14-16s13 6 14 16c-5-6-23-6-28 0Z",
  },
  straight: {
    back: "M17 28c0-11 7-17 15-17s15 6 15 17v22h-6V32H23v18h-6Z",
    front: "M18 30c1-10 7-16 14-16s13 6 14 16c-4-7-10-9-14-9s-10 2-14 9Z",
  },
  curls: {
    front:
      "M18 28a5 5 0 0 1 4-9 6 6 0 0 1 10-5 6 6 0 0 1 10 5 5 5 0 0 1 4 9c-4-3-8-4-14-4s-10 1-14 4Z",
  },
  headwrap: {
    front: "M16 28c0-12 8-19 16-19s16 7 16 19c-6-5-26-5-32 0Zm22-18c5-3 9 0 8 4-3-2-6-2-8-4Z",
  },
  crop: { front: "M19 26c2-7 7-10 13-10s11 3 13 10c-6-3-20-3-26 0Z" },
  waves: {
    front: "M18 28c1-10 7-15 14-15s13 5 14 15c-6-4-22-4-28 0Z",
  },
  knots: {
    back: "M20 10a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm12-5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm12 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z",
    front: "M19 27c2-7 7-10 13-10s11 3 13 10c-6-3-20-3-26 0Z",
  },
  ponytail: {
    back: "M44 18c8 2 11 12 7 24-2-6-5-10-9-12Z",
    front: "M18 29c1-10 7-15 14-15s13 5 14 15c-6-4-22-4-28 0Z",
  },
  fringe: {
    back: "M17 28c0-11 7-17 15-17s15 6 15 17v12h-6V30H23v10h-6Z",
    front: "M18 31c0-11 6-17 14-17s14 6 14 17c-3-4-6-6-9-6h-10c-3 0-6 2-9 6Z",
  },
};

/** Skin tone per face, spread so every tone appears with several hair styles. */
const TONE: Record<AvatarArt, string> = {
  afro: "fill-avatar-tone-4",
  braids: "fill-avatar-tone-3",
  locs: "fill-avatar-tone-4",
  bun: "fill-avatar-tone-1",
  straight: "fill-avatar-tone-2",
  curls: "fill-avatar-tone-3",
  headwrap: "fill-avatar-tone-4",
  crop: "fill-avatar-tone-2",
  waves: "fill-avatar-tone-3",
  knots: "fill-avatar-tone-4",
  ponytail: "fill-avatar-tone-1",
  fringe: "fill-avatar-tone-2",
};

/** One illustrated face: theme colours only, so it suits light and dark mode. */
export const AvatarArtwork = ({
  id,
  className = "h-full w-full",
}: {
  id: AvatarArt;
  className?: string;
}) => {
  const hair = HAIR[id];
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" className="fill-primary" />
      {hair.back && <path d={hair.back} className="fill-foreground" />}
      <ellipse cx="32" cy="35" rx="14" ry="16" className={TONE[id]} />
      {hair.front && <path d={hair.front} className="fill-foreground" />}
      {id === "waves" && (
        <path
          d="M21 22c3-2 5 2 8 0s5 2 8 0 5 2 8 0"
          fill="none"
          className="stroke-primary-foreground"
          strokeWidth="1.2"
        />
      )}
      <g
        fill="none"
        className="stroke-foreground"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      >
        <path d="M25 35q2-2 4 0M35 35q2-2 4 0" />
        <path d="M28 43q4 3 8 0" />
      </g>
    </svg>
  );
};

/** The person's picture: their photo, an illustrated face, or initials. */
export const Avatar = ({
  name,
  choice,
  className = "h-10 w-10 text-sm",
}: {
  name: string;
  choice?: AvatarChoice | undefined;
  className?: string;
}) => {
  const photo = useProfilePhoto(choice?.kind === "photo");
  if (choice?.kind === "photo" && photo) {
    return <img src={photo} alt="" className={`${className} shrink-0 rounded-full object-cover`} />;
  }
  if (choice?.kind === "art") {
    return (
      <span className={`${className} block shrink-0 overflow-hidden rounded-full`}>
        <AvatarArtwork id={choice.id} />
      </span>
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground`}
    >
      {initialsOf(name)}
    </span>
  );
};
