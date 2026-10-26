import { useCallback, useEffect, useState } from "react";

import {
  FOCUS_TASKS_KEY,
  addTask as addTaskPure,
  parseTasks,
  removeTask as removeTaskPure,
  resetToday as resetTodayPure,
  seedTasks,
  toggleTask as toggleTaskPure,
  type FocusTask,
} from "@/lib/focus";

/**
 * Single source of truth for the family's focus tasks.
 * Starts from the seed list, then hydrates from localStorage in an effect so
 * server and client render the same first paint.
 */
export const useFocusTasks = () => {
  const [tasks, setTasks] = useState<FocusTask[]>(seedTasks);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FOCUS_TASKS_KEY);
      if (raw !== null) {
        setTasks(parseTasks(JSON.parse(raw) as unknown));
      }
    } catch {
      // Corrupted storage falls back to the seed list; nothing to recover.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FOCUS_TASKS_KEY, JSON.stringify(tasks));
    } catch {
      // Storage may be unavailable (private mode); the session still works.
    }
  }, [tasks, hydrated]);

  const toggleTask = useCallback(
    (id: string) => setTasks((current) => toggleTaskPure(current, id)),
    [],
  );
  const addTask = useCallback(
    (title: string) => setTasks((current) => addTaskPure(current, title)),
    [],
  );
  const removeTask = useCallback(
    (id: string) => setTasks((current) => removeTaskPure(current, id)),
    [],
  );
  const resetToday = useCallback(
    () => setTasks((current) => resetTodayPure(current)),
    [],
  );

  return { tasks, hydrated, toggleTask, addTask, removeTask, resetToday };
};
