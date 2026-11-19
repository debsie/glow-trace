import { useCallback, useEffect, useState } from "react";

import { EVENTS_KEY, loadEvents } from "@/lib/engagement";
import type { CheckinEvent } from "@/lib/engagement";

/** Check-in events on this device (localStorage, validated on load). */
export const useCheckinEvents = () => {
  const [events, setEvents] = useState<CheckinEvent[]>([]);
  useEffect(() => {
    try {
      setEvents(loadEvents(window.localStorage.getItem(EVENTS_KEY)));
    } catch {
      setEvents([]);
    }
  }, []);
  const save = useCallback((next: CheckinEvent[]) => {
    setEvents(next);
    try {
      window.localStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    } catch {
      // Kept for this visit only.
    }
  }, []);
  return {
    events,
    add: (event: CheckinEvent) => save([...events, event].slice(-30)),
    remove: (id: string) => save(events.filter((event) => event.id !== id)),
  };
};
