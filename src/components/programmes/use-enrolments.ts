import { useCallback, useEffect, useState } from "react";

import { loadEnrolments, PROGRAMMES_KEY } from "@/lib/programmes";
import type { Enrolment } from "@/lib/programmes";

/** Programme enrolments on this device (localStorage, validated on load). */
export const useEnrolments = () => {
  const [enrolments, setEnrolments] = useState<Enrolment[]>([]);
  useEffect(() => {
    try {
      setEnrolments(loadEnrolments(window.localStorage.getItem(PROGRAMMES_KEY)));
    } catch {
      setEnrolments([]);
    }
  }, []);
  const save = useCallback((next: Enrolment[]) => {
    setEnrolments(next);
    try {
      window.localStorage.setItem(PROGRAMMES_KEY, JSON.stringify(next));
    } catch {
      // Kept for this visit only.
    }
  }, []);
  return {
    enrolments,
    start: (id: string, startDay: string) =>
      save([...enrolments.filter((e) => e.id !== id), { id, startDay, ticks: [] }]),
    update: (next: Enrolment) => save(enrolments.map((e) => (e.id === next.id ? next : e))),
    stop: (id: string) => save(enrolments.filter((e) => e.id !== id)),
  };
};
