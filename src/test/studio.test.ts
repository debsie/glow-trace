import { describe, expect, it } from "vitest";

import type { Booking } from "@/lib/studio";
import {
  bookingInsight,
  bookingsIcs,
  clashes,
  dayLoad,
  freeSlots,
  remindersDue,
  trialDate,
  usualService,
  wouldClash,
  countdown,
  dayName,
  DEFAULT_SERVICES,
  duration,
  monthGrid,
  priceListText,
  rand,
  reminderText,
  upcoming,
  whatsappTo,
} from "@/lib/studio";

const booking = (
  id: string,
  date: string,
  time: string,
  serviceId = "event",
  status: Booking["status"] = "booked",
): Booking => ({
  id,
  clientId: "c1",
  serviceId,
  date,
  time,
  note: "",
  status,
});

describe("MUA Studio extras", () => {
  it("formats rand and durations", () => {
    expect(rand(2500)).toBe("R 2 500");
    expect(rand(850)).toBe("R 850");
    expect(duration(90)).toBe("1 h 30 min");
    expect(duration(45)).toBe("45 min");
  });

  it("names days without time-zone drift", () => {
    expect(dayName("2026-12-05")).toBe("Saturday 5 December");
  });

  it("lays a month out Monday to Sunday", () => {
    const grid = monthGrid(2026, 12);
    expect(grid[0]).toEqual([
      null,
      "2026-12-01",
      "2026-12-02",
      "2026-12-03",
      "2026-12-04",
      "2026-12-05",
      "2026-12-06",
    ]);
    expect(grid.flat().filter(Boolean)).toHaveLength(31);
  });

  it("lists upcoming bookings soonest first and finds double bookings", () => {
    const list = [
      booking("a", "2026-12-05", "10:00"),
      booking("b", "2026-12-05", "09:30"),
      booking("c", "2026-11-01", "09:00"),
      booking("d", "2026-12-06", "09:00", "event", "cancelled"),
    ];
    expect(upcoming(list, "2026-11-24").map((b) => b.id)).toEqual(["b", "a"]);
    expect(clashes(list, DEFAULT_SERVICES).map(([x, y]) => [x.id, y.id])).toEqual([["a", "b"]]);
  });

  it("builds WhatsApp links to South African and international numbers", () => {
    expect(whatsappTo("082 123 4567", "hi")).toBe("https://wa.me/27821234567?text=hi");
    expect(whatsappTo("+1 (415) 555-0100", "hi")).toBe("https://wa.me/14155550100?text=hi");
    expect(whatsappTo("thandi@example.com", "hi")).toBe("https://wa.me/?text=hi");
  });

  it("writes the price list and a reminder", () => {
    expect(priceListText(DEFAULT_SERVICES.slice(0, 1), "Debbie")).toContain(
      "Bridal makeup: R 2 500 (2 h)",
    );
    expect(
      reminderText(
        booking("a", "2026-12-05", "07:30", "bridal"),
        "Thandi Nkosi",
        DEFAULT_SERVICES[0],
        "Debbie",
      ),
    ).toContain(
      "Hi Thandi, a reminder of your bridal makeup with Debbie on Saturday 5 December at 07:30.",
    );
  });
});

describe("countdown", () => {
  it("counts whole days across months", () => {
    expect(countdown("2026-11-24", "2026-11-24")).toBe("Today");
    expect(countdown("2026-11-24", "2026-11-25")).toBe("Tomorrow");
    expect(countdown("2026-11-24", "2026-12-05")).toBe("In 11 days");
  });
});

describe("booking intelligence", () => {
  const day = [
    booking("a", "2026-12-05", "08:00", "event"),
    booking("b", "2026-12-05", "11:00", "bridal"),
  ];

  it("suggests free start times around bookings, with travel time", () => {
    const slots = freeSlots(day, DEFAULT_SERVICES, "2026-12-05", 60, 20);
    expect(slots[0]).toBe("05:00");
    expect(slots).not.toContain("08:00");
    expect(slots).toContain("09:30"); // ends exactly as the 10:30 travel buffer starts
    expect(slots).not.toContain("10:00");
    expect(slots).toContain("13:30");
  });

  it("warns before a clash, buffer included", () => {
    expect(wouldClash(day, DEFAULT_SERVICES, "2026-12-05", "09:15", 60)?.id).toBe("a");
    expect(wouldClash(day, DEFAULT_SERVICES, "2026-12-05", "14:00", 60)).toBeNull();
  });

  it("shades busier days darker", () => {
    expect(dayLoad(day, DEFAULT_SERVICES, "2026-12-05")).toBeCloseTo(240 / 900);
    expect(dayLoad(day, DEFAULT_SERVICES, "2026-12-06")).toBe(0);
  });

  it("puts a bridal trial on a Saturday about six weeks before, never in the past", () => {
    expect(trialDate("2027-03-20", "2026-11-24")).toBe("2027-02-06");
    expect(trialDate("2026-12-05", "2026-11-24")).toBe("2026-11-25");
    expect(trialDate("2026-11-25", "2026-11-24")).toBeNull();
  });

  it("remembers a client's usual service and flags reminders due", () => {
    expect(usualService(day, "c1")).toBe("bridal");
    const due = remindersDue(
      [
        booking("x", "2026-11-25", "09:00"),
        { ...booking("y", "2026-11-25", "12:00"), remindedAt: "2026-11-24T08:00:00Z" },
        booking("z", "2026-12-20", "09:00"),
      ],
      "2026-11-24",
    );
    expect(due.map((b) => b.id)).toEqual(["x"]);
  });

  it("names the busiest weekday and the next 30 days", () => {
    const list = [
      booking("1", "2026-11-28", "09:00"),
      booking("2", "2026-12-05", "09:00"),
      booking("3", "2026-12-01", "09:00"),
    ];
    expect(bookingInsight(list, DEFAULT_SERVICES, "2026-11-24")).toBe(
      "Saturdays are your busiest. Next 30 days: 3 bookings, R 2 550.",
    );
  });
});

describe("phone calendar export", () => {
  it("writes a valid .ics with local times, alarms and stable ids", () => {
    const ics = bookingsIcs(
      [
        {
          ...booking("bk1", "2026-12-05", "07:30", "bridal"),
          note: "Church at 11, Durban; bring lashes",
        },
        booking("bk2", "2026-12-06", "09:00", "event", "cancelled"),
      ],
      DEFAULT_SERVICES,
      () => "Thandi Nkosi",
      "20261124T100000Z",
    );
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261205T073000");
    expect(ics).toContain("DTEND:20261205T093000");
    expect(ics).toContain("UID:bk1@glowtrace");
    expect(ics).toContain("SUMMARY:Thandi Nkosi: Bridal makeup");
    expect(ics).toContain("Church at 11\\, Durban\\; bring lashes");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).not.toContain("bk2@glowtrace");
    expect(ics.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });
});
