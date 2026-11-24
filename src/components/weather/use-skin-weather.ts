import { useEffect, useState } from "react";

import type { Forecast, Place } from "@/lib/weather";
import { fetchForecast, loadPlace, savePlace } from "@/lib/weather-client";

/** The person's town and today's forecast, shared by the Home card and the routine. */
export const useSkinWeather = () => {
  const [place, setPlaceState] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [note, setNote] = useState("");
  const [off, setOff] = useState(false);

  useEffect(() => {
    setPlaceState(loadPlace());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!place) return;
    let live = true;
    setNote("Getting today's weather");
    void fetchForecast(place).then((reply) => {
      if (!live) return;
      if ("forecast" in reply) {
        setForecast(reply.forecast);
        setNote("");
      } else {
        setForecast(null);
        setOff(reply.off === true);
        setNote(reply.error);
      }
    });
    return () => {
      live = false;
    };
  }, [place]);

  const setPlace = (next: Place) => {
    savePlace(next);
    setPlaceState(next);
  };

  return { place, ready, forecast, note, off, setPlace };
};
