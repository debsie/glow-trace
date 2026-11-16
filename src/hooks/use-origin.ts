import { useEffect, useState } from "react";

/** The site's origin, read after mount so server and client render the same first HTML. */
export const useOrigin = (): string => {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  return origin;
};
