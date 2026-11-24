import { z } from "zod";

/**
 * MUA Studio extras: the artist's price list and bookings, kept on this device like the client
 * roster, plus the WhatsApp texts built from them. Prices are in rand.
 */

export const serviceSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(1_000_000),
  minutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
});
export type Service = z.infer<typeof serviceSchema>;

export const bookingSchema = z.object({
  id: z.string().min(1).max(64),
  clientId: z.string().min(1).max(64),
  serviceId: z.string().min(1).max(64),
  /** Local date and time, "2026-12-05" and "07:30". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(300).default(""),
  status: z.enum(["booked", "done", "cancelled"]).default("booked"),
  /** When a WhatsApp reminder was last opened for this booking. */
  remindedAt: z.string().optional(),
});
export type Booking = z.infer<typeof bookingSchema>;

export const PRICES_KEY = "glowtrace:studio-prices:v1";
export const BOOKINGS_KEY = "glowtrace:studio-bookings:v1";

/** A starting price list the artist edits; typical South African rates, rounded. */
export const DEFAULT_SERVICES: Service[] = [
  { id: "bridal", name: "Bridal makeup", price: 2500, minutes: 120 },
  { id: "bridal-trial", name: "Bridal trial", price: 1200, minutes: 90 },
  { id: "event", name: "Event makeup", price: 850, minutes: 60 },
  { id: "bridesmaid", name: "Bridesmaid or guest", price: 750, minutes: 60 },
  { id: "matric", name: "Matric dance", price: 900, minutes: 75 },
  { id: "lashes", name: "Strip lashes add-on", price: 150, minutes: 10 },
];

const load = <T>(key: string, schema: z.ZodType<T>, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, value: unknown) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not saved; still works for this visit.
  }
};

export const loadServices = () => load(PRICES_KEY, z.array(serviceSchema), DEFAULT_SERVICES);
export const saveServices = (services: readonly Service[]) => save(PRICES_KEY, services);
export const loadBookings = () => load(BOOKINGS_KEY, z.array(bookingSchema), []);
export const saveBookings = (bookings: readonly Booking[]) => save(BOOKINGS_KEY, bookings);

/** "R 2 500", South African style (space as thousands separator). */
export const rand = (amount: number) =>
  `R ${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;

/** "2 h", "1 h 30 min", "45 min". */
export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
};

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
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

/** "Saturday 5 December" from "2026-12-05", computed without time zones. */
export const dayName = (date: string) => {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[weekday]} ${d} ${MONTHS[m - 1]}`;
};

/** The month grid: weeks Monday to Sunday, each day "YYYY-MM-DD" or null outside the month. */
export const monthGrid = (year: number, month: number): (string | null)[][] => {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d += 1) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
};

export const monthTitle = (year: number, month: number) => `${MONTHS[month - 1]} ${year}`;

/** Upcoming bookings (from `today`, not cancelled), soonest first. */
export const upcoming = (bookings: readonly Booking[], today: string) =>
  bookings
    .filter((b) => b.status === "booked" && b.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

/** Two bookings overlap when their times cross on the same day. */
export const clashes = (
  bookings: readonly Booking[],
  services: readonly Service[],
): [Booking, Booking][] => {
  const minutes = (b: Booking) => {
    const [h = 0, m = 0] = b.time.split(":").map(Number);
    return h * 60 + m;
  };
  const length = (b: Booking) => services.find((s) => s.id === b.serviceId)?.minutes ?? 60;
  const live = bookings.filter((b) => b.status === "booked");
  const out: [Booking, Booking][] = [];
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const a = live[i];
      const b = live[j];
      if (!a || !b || a.date !== b.date) continue;
      if (minutes(a) < minutes(b) + length(b) && minutes(b) < minutes(a) + length(a))
        out.push([a, b]);
    }
  }
  return out;
};

/** WhatsApp link to a number in the client's contact details (South African 0... becomes 27...). */
export const whatsappTo = (contact: string, text: string): string => {
  const digits = contact.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const number = /^0\d{9}$/.test(digits)
    ? `27${digits.slice(1)}`
    : /^\d{10,15}$/.test(digits)
      ? digits
      : "";
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
};

export const priceListText = (services: readonly Service[], artist: string) =>
  [
    `${artist}: price list`,
    "",
    ...services.map((s) => `${s.name}: ${rand(s.price)} (${duration(s.minutes)})`),
    "",
    "Reply here to book a date.",
  ].join("\n");

export const reminderText = (
  booking: Booking,
  client: string,
  service: Service | undefined,
  artist: string,
) =>
  [
    `Hi ${client.split(" ")[0]}, a reminder of your ${service?.name.toLowerCase() ?? "appointment"} with ${artist} on ${dayName(booking.date)} at ${booking.time}.`,
    "Please arrive with a clean, moisturised face, no makeup. Reply if anything changes.",
  ].join("\n");

/** The client brief as a WhatsApp message: occasion, what to work on and the night-before prep. */
export const briefText = (input: {
  client: string;
  artist: string;
  occasion?: string | undefined;
  focus: readonly string[];
  prep: readonly string[];
}) =>
  [
    `Hi ${input.client.split(" ")[0]}, here's your skin brief from ${input.artist}${input.occasion ? ` for ${input.occasion}` : ""}.`,
    input.focus.length ? `What we're working on: ${input.focus.join(", ")}.` : "",
    input.prep.length
      ? ["Before your appointment:", ...input.prep.map((step) => `- ${step}`)].join("\n")
      : "",
    "Any questions, reply here.",
  ]
    .filter(Boolean)
    .join("\n\n");

/** Whole days from `from` to `to` ("YYYY-MM-DD"), computed in UTC so clocks can't shift it. */
export const daysBetween = (from: string, to: string) => {
  const t = (d: string) => {
    const [y = 0, m = 1, day = 1] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((t(to) - t(from)) / 86_400_000);
};

/** "Today", "Tomorrow", "In 3 days". */
export const countdown = (from: string, to: string) => {
  const days = daysBetween(from, to);
  return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
};

/* ---------- Booking intelligence ---------- */

const toMinutes = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const lengthOf = (booking: Booking, services: readonly Service[]) =>
  services.find((s) => s.id === booking.serviceId)?.minutes ?? 60;

/** Working day and the gap kept between appointments for travel and setting up. */
export const DAY_START = 5 * 60;
export const DAY_END = 20 * 60;
export const BUFFER = 30;

/**
 * Start times on `date` where a `minutes`-long appointment fits between existing bookings, with
 * BUFFER minutes either side, on the half hour. Earliest first; at most `limit`.
 */
export const freeSlots = (
  bookings: readonly Booking[],
  services: readonly Service[],
  date: string,
  minutes: number,
  limit = 6,
): string[] => {
  const busy = bookings
    .filter((b) => b.date === date && b.status !== "cancelled")
    .map(
      (b) =>
        [toMinutes(b.time) - BUFFER, toMinutes(b.time) + lengthOf(b, services) + BUFFER] as const,
    );
  const out: string[] = [];
  for (let start = DAY_START; start + minutes <= DAY_END && out.length < limit; start += 30) {
    const end = start + minutes;
    if (busy.every(([from, to]) => end <= from || start >= to)) out.push(toTime(start));
  }
  return out;
};

/** The booking a new one would overlap (buffer included), if any. */
export const wouldClash = (
  bookings: readonly Booking[],
  services: readonly Service[],
  date: string,
  time: string,
  minutes: number,
): Booking | null => {
  const start = toMinutes(time);
  return (
    bookings.find((b) => {
      if (b.date !== date || b.status === "cancelled") return false;
      const from = toMinutes(b.time) - BUFFER;
      const to = toMinutes(b.time) + lengthOf(b, services) + BUFFER;
      return start < to && start + minutes > from;
    }) ?? null
  );
};

/** Share of the working day booked on `date`, 0-1, for shading the calendar. */
export const dayLoad = (bookings: readonly Booking[], services: readonly Service[], date: string) =>
  Math.min(
    1,
    bookings
      .filter((b) => b.date === date && b.status !== "cancelled")
      .reduce((sum, b) => sum + lengthOf(b, services) + BUFFER, 0) /
      (DAY_END - DAY_START),
  );

/** "YYYY-MM-DD" plus `days`, in UTC so clocks can't shift it. */
export const addDays = (date: string, days: number) => {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
};

/**
 * A bridal trial about six weeks before the wedding, moved to the nearest Saturday before it (when
 * most trials happen), and never in the past. Null when there's no room before the wedding.
 */
export const trialDate = (wedding: string, today: string): string | null => {
  let date = addDays(wedding, -42);
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  date = addDays(date, -((weekday + 1) % 7));
  if (date < today) date = addDays(today, 1);
  return date < wedding ? date : null;
};

/** The service a client booked most recently, to preselect it. */
export const usualService = (bookings: readonly Booking[], clientId: string): string | null =>
  [...bookings]
    .filter((b) => b.clientId === clientId && b.status !== "cancelled")
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))[0]?.serviceId ?? null;

/** Booked appointments today, tomorrow or the day after with no reminder sent yet. */
export const remindersDue = (bookings: readonly Booking[], today: string) =>
  upcoming(bookings, today).filter((b) => !b.remindedAt && daysBetween(today, b.date) <= 2);

const WEEKDAY_PLURAL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];

/** One line of insight: the busiest weekday and what's booked over the next 30 days. */
export const bookingInsight = (
  bookings: readonly Booking[],
  services: readonly Service[],
  today: string,
): string | null => {
  const live = bookings.filter((b) => b.status !== "cancelled");
  if (live.length < 3) return null;
  const counts = new Array<number>(7).fill(0);
  for (const b of live) {
    const [y = 0, m = 1, d = 1] = b.date.split("-").map(Number);
    counts[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]! += 1;
  }
  const busiest = counts.indexOf(Math.max(...counts));
  const soon = live.filter((b) => b.date >= today && daysBetween(today, b.date) <= 30);
  const value = soon.reduce(
    (sum, b) => sum + (services.find((s) => s.id === b.serviceId)?.price ?? 0),
    0,
  );
  return `${WEEKDAY_PLURAL[busiest]} are your busiest. Next 30 days: ${soon.length} booking${soon.length === 1 ? "" : "s"}, ${rand(value)}.`;
};

/* ---------- Phone calendar export (iCalendar, RFC 5545) ---------- */

const icsText = (text: string) =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Lines longer than 75 octets are folded, as RFC 5545 asks (calendar apps may reject them). */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ` ${rest.slice(73)}`;
  }
  out.push(rest);
  return out.join("\r\n");
};

/** "2026-12-05" and "07:30" plus minutes, as a floating local time "20261205T073000". */
const icsTime = (date: string, time: string, plusMinutes = 0) => {
  const [y = 0, m = 1, d = 1] = date.split("-").map(Number);
  const [h = 0, min = 0] = time.split(":").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, h, min + plusMinutes));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}${p(t.getUTCMonth() + 1)}${p(t.getUTCDate())}T${p(t.getUTCHours())}${p(t.getUTCMinutes())}00`;
};

/**
 * Bookings as one .ics file that Apple Calendar, Google Calendar and Outlook all open. Times are
 * floating (the phone's own time zone), each event has alarms the evening before and two hours
 * before, and the same booking always gets the same UID so importing again updates, not duplicates.
 */
export const bookingsIcs = (
  bookings: readonly Booking[],
  services: readonly Service[],
  clientName: (id: string) => string,
  stamp: string,
): string => {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Glowtrace//MUA Studio//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const svc = services.find((s) => s.id === b.serviceId);
    const name = clientName(b.clientId);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@glowtrace`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsTime(b.date, b.time)}`,
      `DTEND:${icsTime(b.date, b.time, svc?.minutes ?? 60)}`,
      fold(`SUMMARY:${icsText(`${name}: ${svc?.name ?? "Appointment"}`)}`),
      fold(
        `DESCRIPTION:${icsText([svc ? rand(svc.price) : "", b.note].filter(Boolean).join(" · "))}`,
      ),
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${icsText(`Tomorrow: ${name}`)}`),
      "TRIGGER:-PT12H",
      "END:VALARM",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${icsText(`In two hours: ${name}`)}`),
      "TRIGGER:-PT2H",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
};
