import { useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import { BeforeAfter } from "@/components/progress/before-after";
import { longDate, shortDate } from "@/lib/progress";
import type { ScanRecord } from "@/lib/types";

const AREA = { skin: "Skin", hair: "Hair", nails: "Nails" } as const;

/**
 * Every photo of one client, newest first. Tap two photos of the same area to wipe between them
 * (the first one tapped is "before"). Photos never leave this device.
 */
export const ClientGallery = ({ scans }: { scans: readonly ScanRecord[] }) => {
  const photos = scans
    .filter((scan) => scan.image_url && !scan.demo)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked
    .map((id) => photos.find((p) => p.id === id))
    .filter(Boolean) as ScanRecord[];
  const [first, second] = [...chosen].sort((a, b) => a.created_at.localeCompare(b.created_at));

  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Photos from this client's scans show here.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Tap two photos of the same area to compare them.
      </p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {photos.map((scan, index) => {
          const on = picked.includes(scan.id);
          return (
            <Reveal as="li" key={scan.id} delay={index * 40}>
              <button
                type="button"
                aria-pressed={on}
                aria-label={`${AREA[scan.category]} photo, ${longDate(scan.created_at)}`}
                onClick={() =>
                  setPicked((current) =>
                    on
                      ? current.filter((id) => id !== scan.id)
                      : [
                          ...current.filter(
                            (id) => photos.find((p) => p.id === id)?.category === scan.category,
                          ),
                          scan.id,
                        ].slice(-2),
                  )
                }
                className={`group relative block aspect-square w-full overflow-hidden rounded-2xl border-2 ${on ? "border-primary" : "border-transparent"}`}
              >
                <img
                  src={scan.image_url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
                />
                <span className="absolute inset-x-1 bottom-1 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-semibold">
                  {AREA[scan.category]} · {shortDate(scan.created_at)}
                </span>
              </button>
            </Reveal>
          );
        })}
      </ul>
      {first && second && (
        <BeforeAfter
          before={first.image_url}
          after={second.image_url}
          beforeLabel={longDate(first.created_at)}
          afterLabel={longDate(second.created_at)}
        />
      )}
    </div>
  );
};
