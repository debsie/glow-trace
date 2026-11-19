import { describe, expect, it } from "vitest";

import { HEIC_PROBLEM, pickImage } from "@/lib/photo-intake";

const file = (name: string, type: string) => new File(["x"], name, { type });

describe("Photo intake", () => {
  it("takes the first image among dropped files", () => {
    const result = pickImage(
      [file("notes.txt", "text/plain"), file("me.jpg", "image/jpeg")],
      false,
    );
    expect("file" in result && result.file.name).toBe("me.jpg");
  });

  it("explains a non-photo drop", () => {
    expect(pickImage([file("notes.txt", "text/plain")], false)).toEqual({
      problem: "That isn't a photo. Drop or paste a JPEG, PNG or WebP image.",
    });
  });

  it("explains HEIC where the browser can't open it, and accepts it where it can", () => {
    expect(pickImage([file("IMG_1.HEIC", "")], false)).toEqual({ problem: HEIC_PROBLEM });
    expect("file" in pickImage([file("IMG_1.HEIC", "image/heic")], true)).toBe(true);
  });
});
