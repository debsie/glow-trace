import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  Briefcase,
  Camera,
  ChevronRight,
  CloudSun,
  CreditCard,
  FlaskConical,
  Gift,
  LogOut,
  MessageSquare,
  Moon,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { OPEN_FEEDBACK } from "@/lib/feedback-events";
import { Avatar, AvatarArtwork } from "@/components/profile/avatar";
import { usePrefs, useProfilePhoto } from "@/components/profile/use-profile";
import { Badge, BUTTON_PRIMARY } from "@/components/ui/bits";
import { useAppState } from "@/context/app-state";
import { useAuth } from "@/context/auth";
import { daysLeft } from "@/lib/beta";
import { PLANS, studioAccessGate } from "@/lib/plans";
import type { AvatarChoice, Business, ProfilePrefs } from "@/lib/profile";
import { AVATAR_ARTS, businessSchema, loadPrefs, missingBusiness, savePrefs } from "@/lib/profile";
import { pageHead } from "@/lib/seo";
import type { Theme } from "@/lib/theme";
import { applyTheme, readTheme } from "@/lib/theme";
import { deletePhoto, putPhoto, PROFILE_PHOTO_ID } from "@/lib/vault-store";
import { loadPlace } from "@/lib/weather-client";

export const Route = createFileRoute("/settings")({
  head: () =>
    pageHead({
      title: "Settings — Glowtrace",
      description: "Your profile, appearance, studio details, beta programme and account.",
      path: "/settings",
      noindex: true,
    }),
  component: SettingsPage,
});

/* ---------- Building blocks ---------- */

const Group = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="surface overflow-hidden" aria-label={title}>
    <h2 className="px-5 pt-5 pb-2 font-display text-lg font-semibold">{title}</h2>
    <div className="divide-y divide-border">{children}</div>
  </section>
);

type RowProps = {
  icon: typeof Sun;
  title: string;
  detail?: string | undefined;
  tone?: "danger";
  end?: ReactNode;
} & (
  | { to: string; onClick?: never }
  | { onClick: () => void; to?: never }
  | { to?: never; onClick?: never }
);

const Row = ({ icon: Icon, title, detail, tone, end, ...action }: RowProps) => {
  const body = (
    <>
      <Icon
        className={`h-5 w-5 shrink-0 ${tone === "danger" ? "text-primary" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold ${tone === "danger" ? "text-primary" : ""}`}>
          {title}
        </span>
        {detail && <span className="block text-sm text-muted-foreground">{detail}</span>}
      </span>
      {end ??
        ((action.to || action.onClick) && (
          <ChevronRight className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        ))}
    </>
  );
  const cls =
    "flex min-h-[64px] w-full items-center gap-4 px-5 py-3 text-left transition-colors hover:bg-secondary/60";
  if (action.to)
    return (
      <Link to={action.to} className={cls}>
        {body}
      </Link>
    );
  if (action.onClick)
    return (
      <button type="button" onClick={action.onClick} className={cls}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
};

const Switch = ({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={() => onChange(!on)}
    className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors ${on ? "border-primary bg-primary" : "border-border bg-secondary"}`}
  >
    <span
      className={`inline-block h-6 w-6 rounded-full bg-background transition-transform duration-200 motion-reduce:transition-none ${on ? "translate-x-7" : "translate-x-1"}`}
    />
  </button>
);

/* ---------- Edit profile sheet ---------- */

/** A square, centre-cropped 256 px JPEG of the chosen photo: small, and no camera details kept. */
const squareJpeg = async (file: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = Object.assign(document.createElement("canvas"), { width: 256, height: 256 });
  canvas
    .getContext("2d")
    ?.drawImage(
      bitmap,
      (bitmap.width - side) / 2,
      (bitmap.height - side) / 2,
      side,
      side,
      0,
      0,
      256,
      256,
    );
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("encode"))),
      "image/jpeg",
      0.88,
    ),
  );
};

const EditProfile = ({
  name,
  prefs,
  onClose,
}: {
  name: string;
  prefs: ProfilePrefs;
  onClose: () => void;
}) => {
  const { rename, access } = useAuth();
  const [draftName, setDraftName] = useState(name);
  const [choice, setChoice] = useState<AvatarChoice>(prefs.avatar);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const photo = useProfilePhoto(true);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameField.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const done = async () => {
    setBusy(true);
    if (draftName.trim() !== name && access.kind === "member") {
      const result = await rename(draftName);
      if (!result.ok) {
        setNote(result.reason);
        setBusy(false);
        return;
      }
    }
    if (choice.kind !== "photo" && prefs.avatar.kind === "photo")
      await deletePhoto(PROFILE_PHOTO_ID).catch(() => undefined);
    savePrefs({ ...loadPrefs(), avatar: choice });
    setBusy(false);
    onClose();
  };

  // Rendered on <body>: the page wrapper animates, and a transformed parent would trap a fixed
  // sheet under the phone's bottom menu.
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="sheet-scrim absolute inset-0 bg-foreground/30"
      />
      <div className="sheet-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl">
        <div
          className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border sm:hidden"
          aria-hidden="true"
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="edit-profile-title" className="font-display text-2xl font-semibold">
              Your profile
            </h2>
            <p className="text-sm text-muted-foreground">
              What Glowtrace calls you, and your picture.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex justify-center">
          <Avatar name={draftName || name} choice={choice} className="h-28 w-28 text-3xl" />
        </div>

        <label className="mt-5 block text-sm font-semibold">
          Name
          <input
            ref={nameField}
            value={draftName}
            maxLength={60}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={access.kind !== "member"}
            className="mt-1 min-h-[52px] w-full rounded-2xl border border-input bg-background px-4 text-base font-normal disabled:opacity-60"
          />
        </label>

        <p className="mt-5 text-sm font-semibold">Picture</p>
        <ul className="mt-2 grid grid-cols-5 gap-3" aria-label="Choose a picture">
          <li>
            <label
              className="flex aspect-square cursor-pointer items-center justify-center rounded-full border border-border hover:bg-secondary"
              title="Take or choose a photo"
            >
              <Camera className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">Take or choose a photo</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  try {
                    await putPhoto(PROFILE_PHOTO_ID, await squareJpeg(file));
                    window.dispatchEvent(new Event("glowtrace:profile"));
                    setChoice({ kind: "photo" });
                  } catch {
                    setNote("That photo couldn't be read. Try another.");
                  }
                }}
              />
            </label>
          </li>
          {photo && (
            <li>
              <button
                type="button"
                aria-label="Your photo"
                aria-pressed={choice.kind === "photo"}
                onClick={() => setChoice({ kind: "photo" })}
                className={`block aspect-square w-full overflow-hidden rounded-full ring-offset-2 ring-offset-card ${choice.kind === "photo" ? "ring-2 ring-foreground" : ""}`}
              >
                <img src={photo} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          )}
          <li>
            <button
              type="button"
              aria-label="Your initials"
              aria-pressed={choice.kind === "initials"}
              onClick={() => setChoice({ kind: "initials" })}
              className={`block w-full rounded-full ring-offset-2 ring-offset-card ${choice.kind === "initials" ? "ring-2 ring-foreground" : ""}`}
            >
              <Avatar
                name={draftName || name}
                choice={{ kind: "initials" }}
                className="aspect-square h-auto w-full text-lg"
              />
            </button>
          </li>
          {AVATAR_ARTS.map((id, index) => (
            <li key={id} className="avatar-pop" style={{ animationDelay: `${index * 30}ms` }}>
              <button
                type="button"
                aria-label={`Illustrated face, ${id}`}
                aria-pressed={choice.kind === "art" && choice.id === id}
                onClick={() => setChoice({ kind: "art", id })}
                className={`block aspect-square w-full overflow-hidden rounded-full ring-offset-2 ring-offset-card transition-transform hover:scale-105 motion-reduce:transition-none ${choice.kind === "art" && choice.id === id ? "ring-2 ring-foreground" : ""}`}
              >
                <AvatarArtwork id={id} />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Your photo stays on this device.</p>
        {note && (
          <p className="mt-3 text-sm" role="status">
            {note}
          </p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() => void done()}
          className={`${BUTTON_PRIMARY} mt-6 w-full`}
        >
          {busy ? "Saving" : "Done"}
        </button>
      </div>
    </div>,
    document.body,
  );
};

/* ---------- Studio details ---------- */

const StudioDetails = ({ prefs }: { prefs: ProfilePrefs }) => {
  const [draft, setDraft] = useState<Business>(prefs.business);
  const [saved, setSaved] = useState(false);
  const field =
    "mt-1 min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base font-normal";
  const missing = missingBusiness(draft);
  return (
    <form
      className="grid gap-3 px-5 py-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = businessSchema.safeParse(draft);
        if (!parsed.success) return;
        savePrefs({ ...loadPrefs(), business: parsed.data });
        setDraft(parsed.data);
        setSaved(true);
      }}
    >
      {(
        [
          ["name", "Business name", "e.g. Glow by Thandi", 80],
          ["whatsapp", "WhatsApp number", "e.g. 082 123 4567", 30],
          ["instagram", "Instagram", "@yourhandle", 31],
          ["area", "Where you work", "e.g. Durban and the South Coast", 80],
        ] as const
      ).map(([key, label, hint, max]) => (
        <label key={key} className="text-sm font-semibold">
          {label}
          <input
            value={draft[key]}
            placeholder={hint}
            maxLength={max}
            inputMode={key === "whatsapp" ? "tel" : undefined}
            onChange={(event) => {
              setDraft({ ...draft, [key]: event.target.value });
              setSaved(false);
            }}
            className={field}
          />
        </label>
      ))}
      <label className="text-sm font-semibold sm:col-span-2">
        Specialities
        <input
          value={draft.specialties}
          placeholder="e.g. Bridal, deep skin tones, natural glam"
          maxLength={200}
          onChange={(event) => {
            setDraft({ ...draft, specialties: event.target.value });
            setSaved(false);
          }}
          className={field}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          className="inline-flex min-h-[50px] items-center rounded-lg border border-foreground px-6 font-semibold hover:bg-foreground hover:text-background"
        >
          Save studio details
        </button>
        <p className="text-sm text-muted-foreground" role="status">
          {saved
            ? "Saved. Used in your price list, briefs and reminders."
            : missing.length
              ? `Add your ${missing.join(", ")} so clients know who's messaging them.`
              : ""}
        </p>
      </div>
    </form>
  );
};

/* ---------- Appearance ---------- */

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Auto", icon: Sparkles },
];

const ThemePreview = ({ id }: { id: Theme }) => {
  const half = (dark: boolean) => (
    <span
      className={`flex h-full flex-1 flex-col gap-1.5 p-2 ${dark ? "bg-foreground" : "bg-background"}`}
    >
      <span
        className={`h-1.5 w-8 rounded-full ${dark ? "bg-background/40" : "bg-foreground/30"}`}
      />
      <span className="ml-auto h-2.5 w-10 rounded-full bg-primary/60" />
      <span className={`h-2.5 w-12 rounded-full ${dark ? "bg-background/15" : "bg-secondary"}`} />
      <span
        className={`mt-auto h-3 w-full rounded-full ${dark ? "bg-background/15" : "bg-secondary"}`}
      />
    </span>
  );
  return (
    <span
      className="flex h-24 w-full overflow-hidden rounded-xl border border-border"
      aria-hidden="true"
    >
      {id === "light" ? (
        half(false)
      ) : id === "dark" ? (
        half(true)
      ) : (
        <>
          {half(false)}
          {half(true)}
        </>
      )}
    </span>
  );
};

/* ---------- Page ---------- */

function SettingsPage() {
  const { access, signOut } = useAuth();
  const { profile, tier } = useAppState();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const [editing, setEditing] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [town, setTown] = useState<string | null>(null);
  const member = access.kind === "member";
  const studio = studioAccessGate(tier).allowed;
  const left = member ? daysLeft(access.expiresAt, new Date()) : null;

  useEffect(() => {
    setTheme(readTheme());
    setTown(loadPlace()?.name ?? null);
  }, []);

  if (!prefs) return null;
  const setPrefs = (next: Partial<ProfilePrefs>) => savePrefs({ ...prefs, ...next });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="page-enter flex flex-col items-center pt-4 text-center">
        <Avatar name={profile.display_name} choice={prefs.avatar} className="h-24 w-24 text-2xl" />
        <h1 className="mt-4 font-display text-3xl font-semibold">{profile.display_name}</h1>
        {member && <p className="text-sm text-muted-foreground">{access.email}</p>}
        <div className="mt-2 flex gap-2">
          <Badge tone="primary">{PLANS[tier].name}</Badge>
          {member && <Badge tone="outline">Beta member</Badge>}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-full bg-secondary px-5 text-sm font-semibold hover:bg-secondary/70"
        >
          Edit profile
        </button>
      </header>

      <Group title="Glowtrace">
        <div className="px-5 py-4">
          <p className="flex items-center gap-4 font-semibold">
            <Moon className="h-5 w-5 text-muted-foreground" aria-hidden="true" /> Appearance
          </p>
          <div className="mt-3 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Appearance">
            {THEMES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={theme === id}
                onClick={() => {
                  applyTheme(id);
                  setTheme(id);
                }}
                className="flex flex-col items-center gap-2"
              >
                <span
                  className={`block w-full rounded-2xl p-1 ${theme === id ? "ring-2 ring-primary" : ""}`}
                >
                  <ThemePreview id={id} />
                </span>
                <span
                  className={`text-sm ${theme === id ? "font-semibold" : "text-muted-foreground"}`}
                >
                  {label}
                </span>
              </button>
            ))}
          </div>
        </div>
        <Row icon={CloudSun} title="Skin weather town" detail={town ?? "Not set"} to="/app" />
        <Row icon={BookOpen} title="See the welcome tour again" to="/welcome" />
      </Group>

      {studio && (
        <Group title="Studio">
          <Row
            icon={Briefcase}
            title="Studio details"
            detail={prefs.business.name || "Business name, WhatsApp, Instagram, area"}
            onClick={() => setStudioOpen((open) => !open)}
            end={
              <ChevronRight
                className={`h-5 w-5 text-muted-foreground transition-transform ${studioOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              />
            }
          />
          {studioOpen && <StudioDetails prefs={prefs} />}
          <Row
            icon={CreditCard}
            title="Price list"
            detail="Your services and prices"
            to="/pro/prices"
          />
          <Row
            icon={BookOpen}
            title="Bookings"
            detail="Calendar, reminders and phone calendar"
            to="/pro/bookings"
          />
        </Group>
      )}

      <Group title="Beta programme">
        <Row
          icon={Sparkles}
          title={member ? "You're a beta tester" : "Become a beta tester"}
          detail={
            member
              ? left === null
                ? "Open-ended access. Thank you for testing."
                : `${left} day${left === 1 ? "" : "s"} of access left`
              : "Ask for early access to Glowtrace"
          }
          {...(member ? {} : { to: "/login" })}
        />
        <Row
          icon={FlaskConical}
          title="Try new features early"
          detail="See features before they're finished, and tell us what you think"
          end={
            <Switch
              on={prefs.earlyAccess}
              label="Try new features early"
              onChange={(on) => setPrefs({ earlyAccess: on })}
            />
          }
        />
        {member && (
          <Row
            icon={Shield}
            title="Help train Glowtrace"
            detail="Share photos you choose, delete any time"
            to="/privacy"
          />
        )}
        {member && (
          <Row
            icon={Sun}
            title="Lighting challenge"
            detail="Three selfies, three lights"
            to="/lighting-challenge"
          />
        )}
      </Group>

      <Group title="Plan">
        <Row
          icon={CreditCard}
          title={`${PLANS[tier].name} plan`}
          detail="Compare plans"
          to="/pricing"
        />
        <Row
          icon={Gift}
          title="Refer and earn"
          detail="Invite friends, earn free months"
          to="/refer"
        />
      </Group>

      <Group title="Account">
        <Row
          icon={Shield}
          title="Your data and privacy"
          detail="Download or delete what Glowtrace keeps"
          to="/privacy"
        />
        <Row
          icon={MessageSquare}
          title="Give feedback"
          onClick={() => window.dispatchEvent(new Event(OPEN_FEEDBACK))}
        />
        {member && (
          <Row
            icon={Trash2}
            title="Delete account"
            detail="On the privacy page, after a confirmation"
            to="/privacy"
          />
        )}
        {member && (
          <Row
            icon={LogOut}
            title="Sign out"
            tone="danger"
            onClick={() => void signOut().then(() => navigate({ to: "/" }))}
          />
        )}
      </Group>

      <p className="pb-6 text-center text-xs text-muted-foreground">Glowtrace beta</p>

      {editing && (
        <EditProfile name={profile.display_name} prefs={prefs} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
