import { useEffect, useState } from "react";

import type { ProfilePrefs } from "@/lib/profile";
import { loadPrefs, PROFILE_EVENT } from "@/lib/profile";
import { getPhotos, PROFILE_PHOTO_ID } from "@/lib/vault-store";

/** The profile photo kept on this device, as an object URL while shown. */
export const useProfilePhoto = (enabled: boolean): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      setUrl(null);
      return;
    }
    let live = true;
    let made: string | null = null;
    const load = () =>
      void getPhotos([PROFILE_PHOTO_ID])
        .then((photos) => {
          const blob = photos.get(PROFILE_PHOTO_ID);
          if (!live) return;
          if (made) URL.revokeObjectURL(made);
          made = blob ? URL.createObjectURL(blob) : null;
          setUrl(made);
        })
        .catch(() => setUrl(null));
    load();
    window.addEventListener(PROFILE_EVENT, load);
    return () => {
      live = false;
      window.removeEventListener(PROFILE_EVENT, load);
      if (made) URL.revokeObjectURL(made);
    };
  }, [enabled]);
  return url;
};

/** Profile settings that refresh whenever they're saved anywhere. */
export const usePrefs = (): ProfilePrefs | null => {
  const [prefs, setPrefs] = useState<ProfilePrefs | null>(null);
  useEffect(() => {
    const read = () => setPrefs(loadPrefs());
    read();
    window.addEventListener(PROFILE_EVENT, read);
    return () => window.removeEventListener(PROFILE_EVENT, read);
  }, []);
  return prefs;
};
