import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { StudioGate } from "@/components/studio/studio-gate";
import { Badge, BUTTON_PRIMARY } from "@/components/ui/bits";
import { usePrefs } from "@/components/profile/use-profile";
import { useAppState } from "@/context/app-state";
import { pageHead } from "@/lib/seo";
import type { Booking, Service } from "@/lib/studio";
import {
  bookingInsight,
  bookingsIcs,
  bookingSchema,
  clashes,
  dayLoad,
  freeSlots,
  remindersDue,
  trialDate,
  usualService,
  wouldClash,
  countdown,
  dayName,
  duration,
  loadBookings,
  loadServices,
  monthGrid,
  monthTitle,
  rand,
  reminderText,
  saveBookings,
  upcoming,
  whatsappTo,
} from "@/lib/studio";

export const Route = createFileRoute("/pro/bookings")({
  head: () =>
    pageHead({
      title: "Bookings — Glowtrace MUA Studio",
      description: "Your bookings by month, with WhatsApp reminders for every client.",
      path: "/pro/bookings",
      noindex: true,
    }),
  component: () => (
    <StudioGate title="Bookings">
      <BookingsPage />
    </StudioGate>
  ),
});

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const field =
  "mt-1 min-h-[50px] w-full rounded-2xl border border-input bg-background px-4 text-base font-normal";
const small =
  "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";

/** Today as "YYYY-MM-DD" in the phone's own time (client only). */
const localToday = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));

function BookingsPage() {
  const { clients, profile } = useAppState();
  const active = clients.filter((client) => !client.archived);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [today, setToday] = useState("");
  const [view, setView] = useState({ year: 2026, month: 1 });
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState({ clientId: "", serviceId: "", time: "08:00", note: "" });
  const [message, setMessage] = useState("");
  const [trial, setTrial] = useState<{ clientId: string; date: string } | null>(null);

  useEffect(() => {
    const now = localToday();
    setToday(now);
    setSelected(now);
    setView({ year: Number(now.slice(0, 4)), month: Number(now.slice(5, 7)) });
    setBookings(loadBookings());
    const list = loadServices();
    setServices(list);
    setDraft((d) => ({ ...d, serviceId: list[0]?.id ?? "" }));
  }, []);

  const update = (next: Booking[]) => {
    setBookings(next);
    saveBookings(next);
  };
  const byDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (b.status === "cancelled") continue;
      map.set(b.date, [...(map.get(b.date) ?? []), b]);
    }
    return map;
  }, [bookings]);
  const overlaps = useMemo(() => clashes(bookings, services), [bookings, services]);
  const client = (id: string) => clients.find((c) => c.id === id);
  const service = (id: string) => services.find((s) => s.id === id);
  const prefs = usePrefs();
  const artist = prefs?.business.name || profile.display_name || "your artist";
  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const m = month + delta;
      return m < 1
        ? { year: year - 1, month: 12 }
        : m > 12
          ? { year: year + 1, month: 1 }
          : { year, month: m };
    });

  const monthKey = `${view.year}-${String(view.month).padStart(2, "0")}`;
  const inMonth = bookings.filter((b) => b.status !== "cancelled" && b.date.startsWith(monthKey));
  const monthTotal = inMonth.reduce((sum, b) => sum + (service(b.serviceId)?.price ?? 0), 0);
  const dayBookings = [...(byDay.get(selected) ?? [])].sort((a, b) => a.time.localeCompare(b.time));
  const next = today ? upcoming(bookings, today) : [];
  const nextUp = next[0];
  const setStatus = (id: string, status: Booking["status"]) =>
    update(bookings.map((b) => (b.id === id ? { ...b, status } : b)));

  const markReminded = (id: string) =>
    update(bookings.map((b) => (b.id === id ? { ...b, remindedAt: new Date().toISOString() } : b)));
  const due = today ? remindersDue(bookings, today) : [];
  const insight = today ? bookingInsight(bookings, services, today) : null;
  const draftClient = draft.clientId || active[0]?.id || "";
  const draftService = service(draft.serviceId);
  const draftMinutes = draftService?.minutes ?? 60;
  const slots = selected ? freeSlots(bookings, services, selected, draftMinutes) : [];
  const clashWith = selected
    ? wouldClash(bookings, services, selected, draft.time, draftMinutes)
    : null;
  // Start the time at the first free slot whenever the day or service changes.
  const firstFree = slots[0];
  useEffect(() => {
    if (
      firstFree &&
      selected &&
      wouldClash(bookings, services, selected, draft.time, draftMinutes)
    ) {
      setDraft((d) => ({ ...d, time: firstFree }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, draft.serviceId, firstFree]);

  /**
   * Hands bookings to the phone's calendar as an .ics file: the share sheet on phones (choose
   * Calendar), a download elsewhere (open it to add). Importing again updates, never duplicates.
   */
  const toCalendar = async (list: readonly Booking[], name: string) => {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    const ics = bookingsIcs(list, services, (id) => client(id)?.client_name ?? "Client", stamp);
    const file = new File([ics], `${name}.ics`, { type: "text/calendar" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Glowtrace bookings" });
        return;
      }
    } catch {
      // Share sheet closed or unavailable: fall back to a download.
    }
    const url = URL.createObjectURL(file);
    const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage("Calendar file saved. Open it to add to your phone's calendar");
  };

  const reminder = (booking: Booking) => {
    const who = client(booking.clientId);
    return whatsappTo(
      who?.contact_info ?? "",
      reminderText(booking, who?.client_name ?? "there", service(booking.serviceId), artist),
    );
  };

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        {/* Left: the month, set large, and a compact calendar. */}
        <section className="page-enter" aria-labelledby="month-title">
          <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            Bookings
          </p>
          <h1
            id="month-title"
            key={monthKey}
            className="page-enter mt-3 font-display text-6xl leading-[0.9] font-semibold tracking-tight sm:text-7xl"
          >
            {MONTH_NAMES[view.month - 1]}
            <span className="block text-muted-foreground">{view.year}</span>
          </h1>

          <dl className="mt-8 grid grid-cols-2 gap-6 border-y border-border py-5">
            <div>
              <dt className="text-xs text-muted-foreground">Booked this month</dt>
              <dd className="readout mt-1 text-3xl">{rand(monthTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Appointments</dt>
              <dd className="readout mt-1 text-3xl">{inMonth.length}</dd>
            </div>
          </dl>

          {insight && <p className="mt-4 text-sm text-muted-foreground">{insight}</p>}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm font-semibold">{monthTitle(view.year, view.month)}</p>
            <div className="flex gap-1">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => shift(-1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => shift(1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-secondary"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            className="mt-2 grid grid-cols-7 text-center text-[11px] font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {WEEK.map((day, i) => (
              <span key={i} className="py-1">
                {day}
              </span>
            ))}
          </div>
          <div
            key={`grid-${monthKey}`}
            className="grid grid-cols-7 gap-y-1"
            role="grid"
            aria-label={monthTitle(view.year, view.month)}
          >
            {monthGrid(view.year, view.month)
              .flat()
              .map((date, index) => {
                if (!date) return <span key={`e${index}`} />;
                const count = byDay.get(date)?.length ?? 0;
                const load = dayLoad(bookings, services, date);
                const isSelected = date === selected;
                const isToday = date === today;
                return (
                  <button
                    key={date}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${dayName(date)}${count ? `, ${count} booking${count === 1 ? "" : "s"}` : ""}`}
                    onClick={() => setSelected(date)}
                    className="cal-cell group flex min-h-[48px] flex-col items-center justify-center"
                    style={{ "--i": index } as CSSProperties}
                  >
                    <span
                      style={
                        !isSelected && load > 0
                          ? {
                              backgroundColor: `color-mix(in oklch, var(--primary) ${Math.round(8 + load * 30)}%, transparent)`,
                            }
                          : undefined
                      }
                      className={`readout flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors duration-200 ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : isToday
                            ? "text-primary ring-1 ring-primary"
                            : "group-hover:bg-secondary"
                      }`}
                    >
                      {Number(date.slice(8))}
                    </span>
                    <span className="mt-0.5 flex h-1 gap-0.5" aria-hidden="true">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} className="h-1 w-1 rounded-full bg-primary" />
                      ))}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* Right: what's next, then the chosen day as a timeline. */}
        <div className="min-w-0 space-y-8">
          {due.length > 0 && (
            <section className="surface page-enter p-5" aria-labelledby="reminders-due">
              <h2
                id="reminders-due"
                className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase"
              >
                Reminders to send · {due.length}
              </h2>
              <ul className="mt-3 divide-y divide-border">
                {due.map((booking) => (
                  <li
                    key={booking.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-2"
                  >
                    <span className="text-sm">
                      <span className="font-semibold">{client(booking.clientId)?.client_name}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {countdown(today, booking.date)} at {booking.time}
                      </span>
                    </span>
                    <a
                      href={reminder(booking)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => markReminded(booking.id)}
                      className={small}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" /> Remind
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="surface-strong page-enter relative overflow-hidden p-6 sm:p-8"
            aria-labelledby="next-up"
          >
            <p
              id="next-up"
              className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase"
            >
              Next up
            </p>
            {nextUp ? (
              <>
                <p className="mt-4 font-display text-5xl leading-none font-semibold sm:text-6xl">
                  {countdown(today, nextUp.date)}
                  <span className="readout ml-3 align-baseline text-2xl text-muted-foreground sm:text-3xl">
                    {nextUp.time}
                  </span>
                </p>
                <p className="mt-4 text-lg">
                  <span className="font-semibold">{client(nextUp.clientId)?.client_name}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {service(nextUp.serviceId)?.name} · {dayName(nextUp.date)}
                  </span>
                </p>
                <a
                  href={reminder(nextUp)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => markReminded(nextUp.id)}
                  className={`${BUTTON_PRIMARY} mt-6`}
                >
                  <MessageCircle className="h-5 w-5" aria-hidden="true" /> Send a WhatsApp reminder
                </a>
                <button
                  type="button"
                  onClick={() => void toCalendar(next, "glowtrace-bookings")}
                  className={`${small} mt-3 ml-1`}
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add all {next.length}{" "}
                  upcoming to my phone calendar
                </button>
              </>
            ) : (
              <p className="mt-4 font-display text-4xl font-semibold">A clear diary</p>
            )}
          </section>

          <section aria-labelledby="day-title">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="day-title" className="font-display text-2xl font-semibold">
                {selected ? dayName(selected) : "Today"}
              </h2>
              <span className="text-sm text-muted-foreground">
                {dayBookings.length
                  ? `${dayBookings.length} booking${dayBookings.length === 1 ? "" : "s"}`
                  : "Free"}
              </span>
            </div>
            {dayBookings.length === 0 ? (
              <p className="mt-4 border-l border-border py-3 pl-5 text-sm text-muted-foreground">
                Nothing booked. Add one below.
              </p>
            ) : (
              <ol key={selected} className="timeline relative mt-5 space-y-5">
                {dayBookings.map((booking, index) => {
                  const svc = service(booking.serviceId);
                  const clash = overlaps.some(
                    ([a, b]) => a.id === booking.id || b.id === booking.id,
                  );
                  return (
                    <li
                      key={booking.id}
                      className="timeline-item relative grid grid-cols-[56px_1fr] gap-4"
                      style={{ "--i": index } as CSSProperties}
                    >
                      <span className="readout pt-1 text-sm text-muted-foreground">
                        {booking.time}
                      </span>
                      <div className="relative min-w-0 border-l border-border pb-1 pl-5">
                        <span
                          className={`absolute top-2 -left-[5px] h-2.5 w-2.5 rounded-full ${booking.status === "done" ? "bg-success" : "bg-primary"}`}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="font-display text-xl font-semibold">
                            {client(booking.clientId)?.client_name ?? "Client"}
                          </p>
                          <span className="readout">{svc ? rand(svc.price) : ""}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {svc?.name}
                          {svc ? ` · ${duration(svc.minutes)}` : ""}
                          {booking.note ? ` · ${booking.note}` : ""}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1">
                          {clash && <Badge tone="warning">Overlaps another booking</Badge>}
                          {booking.status === "done" ? (
                            <Badge tone="success">Done</Badge>
                          ) : (
                            <>
                              <a
                                href={reminder(booking)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => markReminded(booking.id)}
                                className={small}
                              >
                                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Remind
                              </a>
                              <button
                                type="button"
                                onClick={() => setStatus(booking.id, "done")}
                                className={small}
                              >
                                <Check className="h-4 w-4" aria-hidden="true" /> Done
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatus(booking.id, "cancelled")}
                                className={small}
                              >
                                <X className="h-4 w-4" aria-hidden="true" /> Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void toCalendar([booking], `glowtrace-${booking.date}`)
                                }
                                className={small}
                              >
                                <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Calendar
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {active.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Add a client first on the{" "}
                <Link to="/pro/clients" className="font-semibold text-primary hover:underline">
                  Clients
                </Link>{" "}
                page.
              </p>
            ) : (
              <form
                className="surface mt-6 grid gap-3 p-4 sm:grid-cols-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const parsed = bookingSchema.safeParse({
                    id: `bk_${Date.now().toString(36)}`,
                    clientId: draft.clientId || active[0]?.id,
                    serviceId: draft.serviceId || services[0]?.id,
                    date: selected,
                    time: draft.time,
                    note: draft.note,
                    status: "booked",
                  });
                  if (!parsed.success) {
                    setMessage("Pick a client, a service and a time");
                    return;
                  }
                  update([...bookings, parsed.data]);
                  setDraft({ ...draft, note: "" });
                  setMessage(
                    `Booked ${client(parsed.data.clientId)?.client_name ?? "the client"} for ${dayName(parsed.data.date)}`,
                  );
                  // A wedding with no trial booked yet: offer one about six weeks before.
                  const hasTrial = bookings.some(
                    (b) =>
                      b.clientId === parsed.data.clientId &&
                      b.serviceId === "bridal-trial" &&
                      b.status !== "cancelled",
                  );
                  const date = trialDate(parsed.data.date, today);
                  setTrial(
                    parsed.data.serviceId === "bridal" && !hasTrial && date
                      ? { clientId: parsed.data.clientId, date }
                      : null,
                  );
                }}
              >
                <p className="text-sm font-semibold sm:col-span-2">Book on this day</p>
                <label className="text-sm font-semibold">
                  Client
                  <select
                    className={field}
                    value={draft.clientId || active[0]?.id}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        clientId: e.target.value,
                        // Preselect what this client usually books.
                        serviceId: usualService(bookings, e.target.value) ?? draft.serviceId,
                      })
                    }
                  >
                    {active.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.client_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Service
                  <select
                    className={field}
                    value={draft.serviceId}
                    onChange={(e) => setDraft({ ...draft, serviceId: e.target.value })}
                  >
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.name} · {rand(svc.price)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Time
                  <input
                    type="time"
                    className={field}
                    value={draft.time}
                    required
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Note (optional)
                  <input
                    className={field}
                    value={draft.note}
                    maxLength={300}
                    onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  />
                </label>
                {slots.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Free for {duration(draftMinutes)}, with travel time either side
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {slots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          aria-pressed={draft.time === slot}
                          onClick={() => setDraft({ ...draft, time: slot })}
                          className={`readout min-h-[44px] rounded-full border px-4 text-sm transition-colors ${
                            draft.time === slot
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:bg-secondary"
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {clashWith && (
                  <p className="text-sm text-warning sm:col-span-2" role="alert">
                    This runs into {client(clashWith.clientId)?.client_name ?? "another booking"} at{" "}
                    {clashWith.time}, travel time included. Pick a free time above.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
                  <button
                    type="submit"
                    className="inline-flex min-h-[50px] items-center rounded-lg border border-foreground px-6 font-semibold hover:bg-foreground hover:text-background"
                  >
                    Book it
                  </button>
                  <p className="text-sm" role="status">
                    {message}
                  </p>
                </div>
              </form>
            )}
            {trial && (
              <div className="surface page-enter mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm">
                  <span className="font-semibold">Book her trial?</span>{" "}
                  <span className="text-muted-foreground">
                    {client(trial.clientId)?.client_name} has no trial yet. {dayName(trial.date)} is
                    about six weeks before.
                  </span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={small}
                    onClick={() => {
                      const slot =
                        freeSlots(
                          bookings,
                          services,
                          trial.date,
                          service("bridal-trial")?.minutes ?? 90,
                        )[2] ?? "10:00";
                      update([
                        ...bookings,
                        {
                          id: `bk_${Date.now().toString(36)}`,
                          clientId: trial.clientId,
                          serviceId: "bridal-trial",
                          date: trial.date,
                          time: slot,
                          note: "Bridal trial",
                          status: "booked",
                        },
                      ]);
                      setMessage(`Trial booked for ${dayName(trial.date)} at ${slot}`);
                      setSelected(trial.date);
                      setView({
                        year: Number(trial.date.slice(0, 4)),
                        month: Number(trial.date.slice(5, 7)),
                      });
                      setTrial(null);
                    }}
                  >
                    <Check className="h-4 w-4" aria-hidden="true" /> Book the trial
                  </button>
                  <button type="button" className={small} onClick={() => setTrial(null)}>
                    Not now
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      {next.length > 1 && (
        <section aria-labelledby="coming-up">
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="coming-up"
              className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase"
            >
              Coming up
            </h2>
            <Link
              to="/pro/prices"
              className="inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Price list <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
            {next.slice(0, 10).map((booking, index) => {
              const [, m = "1", d = "1"] = booking.date.split("-");
              return (
                <li
                  key={booking.id}
                  className="ticket surface lift w-56 shrink-0 snap-start p-5"
                  style={{ "--i": index } as CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(booking.date);
                      setView({ year: Number(booking.date.slice(0, 4)), month: Number(m) });
                    }}
                    className="block w-full text-left"
                    aria-label={`${client(booking.clientId)?.client_name ?? "Client"}, ${dayName(booking.date)} at ${booking.time}`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="readout text-5xl leading-none">{Number(d)}</span>
                      <span className="text-sm font-semibold text-muted-foreground uppercase">
                        {MONTH_SHORT[Number(m) - 1]}
                      </span>
                    </span>
                    <span className="mt-4 block truncate font-semibold">
                      {client(booking.clientId)?.client_name ?? "Client"}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {service(booking.serviceId)?.name} · {booking.time}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs text-muted-foreground">Bookings stay on this device.</p>
    </div>
  );
}
