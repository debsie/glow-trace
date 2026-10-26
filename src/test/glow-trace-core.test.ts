import { describe, expect, it } from "vitest";

import {
  addTask,
  countDone,
  isFourDigits,
  progressPercent,
  removeTask,
  resetToday,
  seedTasks,
  toggleTask,
  verifyPin,
} from "@/lib/focus";

// Hackathon rule under test: Parent Mode is gated by an exact 4-digit PIN.
describe("Parent PIN gate", () => {
  it("accepts only the exact 4-digit PIN", () => {
    expect(verifyPin("1234", "1234")).toBe(true);
    expect(verifyPin("1235", "1234")).toBe(false);
    expect(verifyPin("4321", "1234")).toBe(false);
  });

  it("rejects entries that are not exactly four digits", () => {
    expect(verifyPin("123", "123")).toBe(false);
    expect(verifyPin("12345", "12345")).toBe(false);
    expect(verifyPin("abcd", "abcd")).toBe(false);
    expect(verifyPin("", "")).toBe(false);
    expect(isFourDigits("12a4")).toBe(false);
    expect(isFourDigits("9876")).toBe(true);
  });
});

// Rule under test: tasks toggle independently and drive the glow meter.
describe("Focus tasks", () => {
  it("toggles one task without touching the others", () => {
    const tasks = seedTasks();
    const toggled = toggleTask(tasks, "seed-2");
    expect(toggled.find((t) => t.id === "seed-2")?.done).toBe(true);
    expect(toggled.find((t) => t.id === "seed-1")?.done).toBe(false);
    expect(toggled).toHaveLength(tasks.length);
  });

  it("counts completed tasks for the glow meter", () => {
    let tasks = seedTasks();
    expect(countDone(tasks)).toBe(0);
    expect(progressPercent(tasks)).toBe(0);
    tasks = toggleTask(tasks, "seed-1");
    tasks = toggleTask(tasks, "seed-3");
    expect(countDone(tasks)).toBe(2);
    expect(progressPercent(tasks)).toBe(40);
  });

  it("adds a trimmed task and removes by id", () => {
    let tasks = seedTasks();
    tasks = addTask(tasks, "  Water the plant  ");
    expect(tasks).toHaveLength(6);
    expect(tasks.at(-1)?.title).toBe("Water the plant");
    const addedId = tasks.at(-1)?.id ?? "";
    tasks = addTask(tasks, "   ");
    expect(tasks).toHaveLength(6);
    tasks = removeTask(tasks, addedId);
    expect(tasks).toHaveLength(5);
  });

  it("resets every task for a new day", () => {
    let tasks = toggleTask(seedTasks(), "seed-1");
    tasks = resetToday(tasks);
    expect(countDone(tasks)).toBe(0);
  });
});
