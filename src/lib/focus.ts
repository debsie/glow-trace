import { z } from "zod";

/** Pure core logic for Glow Trace: tasks, progress and the parent PIN gate. */

export const FOCUS_TASKS_KEY = "glow-trace:focus-tasks:v1";
export const PARENT_PIN_KEY = "glow-trace:parent-pin:v1";

export const FocusTaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(120),
  done: z.boolean(),
  createdAt: z.number().int().nonnegative(),
});
export type FocusTask = z.infer<typeof FocusTaskSchema>;

export const TaskListSchema = z.array(FocusTaskSchema);

/** Calm, doable starter tasks shown until the family edits their own list. */
export const seedTasks = (): FocusTask[] => [
  { id: "seed-1", title: "Read for 10 minutes", done: false, createdAt: 1 },
  { id: "seed-2", title: "Finish one worksheet page", done: false, createdAt: 2 },
  { id: "seed-3", title: "Tidy my desk", done: false, createdAt: 3 },
  { id: "seed-4", title: "Stretch and take five slow breaths", done: false, createdAt: 4 },
  { id: "seed-5", title: "Draw something you love", done: false, createdAt: 5 },
];

/** Storage can hold anything; never trust it without validating first. */
export const parseTasks = (raw: unknown): FocusTask[] => {
  const result = TaskListSchema.safeParse(raw);
  return result.success ? result.data : seedTasks();
};

export const toggleTask = (tasks: FocusTask[], id: string): FocusTask[] =>
  tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task));

export const addTask = (tasks: FocusTask[], title: string): FocusTask[] => {
  const clean = title.trim().slice(0, 120);
  if (!clean) return tasks;
  return [
    ...tasks,
    { id: `task-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, title: clean, done: false, createdAt: Date.now() },
  ];
};

export const removeTask = (tasks: FocusTask[], id: string): FocusTask[] =>
  tasks.filter((task) => task.id !== id);

export const resetToday = (tasks: FocusTask[]): FocusTask[] =>
  tasks.map((task) => ({ ...task, done: false }));

export const countDone = (tasks: FocusTask[]): number =>
  tasks.filter((task) => task.done).length;

export const progressPercent = (tasks: FocusTask[]): number => {
  if (tasks.length === 0) return 0;
  return Math.round((countDone(tasks) / tasks.length) * 100);
};

/** Exactly four digits, and an exact match. */
export const isFourDigits = (value: string): boolean => /^\d{4}$/.test(value);

export const verifyPin = (entry: string, pin: string): boolean =>
  isFourDigits(entry) && entry === pin;

export const DEFAULT_PIN = "1234";

export const parsePin = (raw: unknown): string =>
  typeof raw === "string" && isFourDigits(raw) ? raw : DEFAULT_PIN;
