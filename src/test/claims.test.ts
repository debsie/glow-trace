import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "ui" ? [] : walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });

const files = [...walk("src/routes"), ...walk("src/components"), ...walk("src/content")];
const BANNED = [
  /lab report/i,
  /inflam/i,
  /\bErythema\b/,
  /treatment (routine|serum)/i,
  /Undiagnosed/,
];

describe("Wellness wording", () => {
  it("keeps medical claims out of user-facing copy", () => {
    const hits = files.flatMap((file) =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => BANNED.some((term) => term.test(line)))
        .map((line) => `${file}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});
