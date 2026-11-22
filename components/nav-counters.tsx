"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Counters = Record<string, number>;
type Ctx = { counts: Counters; refresh: () => void };

const NavCountersContext = createContext<Ctx>({ counts: {}, refresh: () => {} });

/** Event that any client code can dispatch to update the menu badges right away. */
export const NAV_COUNTERS_EVENT = "nav-counters:refresh";

export function requestNavCountersRefresh() {
  window.dispatchEvent(new Event(NAV_COUNTERS_EVENT));
}

const POLL_MS = 30_000;

/** Keeps the menu badge counts fresh: polling, window focus, and explicit refresh events. */
export function NavCountersProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [counts, setCounts] = useState<Counters>({});
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (!enabled || inFlight.current) return;
    inFlight.current = true;
    fetch("/api/nav-counters", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Counters | null) => {
        if (data) setCounts(data);
      })
      .catch(() => {})
      .finally(() => {
        inFlight.current = false;
      });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    window.addEventListener(NAV_COUNTERS_EVENT, refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NAV_COUNTERS_EVENT, refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, refresh]);

  const value = useMemo(() => ({ counts, refresh }), [counts, refresh]);
  return <NavCountersContext.Provider value={value}>{children}</NavCountersContext.Provider>;
}

export function useNavCounters() {
  return useContext(NavCountersContext);
}

/** Red circle with a number; renders nothing for zero. */
export function CountBadge({ value, className = "" }: { value: number | undefined; className?: string }) {
  if (!value) return null;
  return (
    <span
      className={`inline-grid h-5 min-w-5 place-items-center rounded-full bg-gradient-to-br from-rose-400 to-rose-600 px-1.5 text-[11px] leading-none font-semibold text-white shadow-[0_2px_6px_-1px_rgba(178,87,61,0.6)] ring-2 ring-white ${className}`}
      aria-label={`${value} новых`}
    >
      {value > 99 ? "99+" : value}
    </span>
  );
}
