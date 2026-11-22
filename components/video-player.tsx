"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { VideoSource } from "@/lib/video";
import { formatClock } from "@/lib/format";

/* Minimal typings for the provider SDKs we use */
type YTPlayer = {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  seekTo(s: number, allowSeekAhead: boolean): void;
  destroy(): void;
};
type VimeoPlayer = {
  on(ev: string, cb: (d: { seconds: number; duration: number }) => void): void;
  setCurrentTime(s: number): Promise<number>;
  getDuration(): Promise<number>;
  destroy(): Promise<void>;
};
declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer; PlayerState: { PLAYING: number } };
    onYouTubeIframeAPIReady?: () => void;
    Vimeo?: { Player: new (el: HTMLElement, opts: unknown) => VimeoPlayer };
  }
}

const scriptPromises = new Map<string, Promise<void>>();
function loadScript(src: string, ready: () => boolean, onReadyHook?: (resolve: () => void) => void) {
  if (ready()) return Promise.resolve();
  if (!scriptPromises.has(src)) {
    scriptPromises.set(
      src,
      new Promise<void>((resolve, reject) => {
        onReadyHook?.(resolve);
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => {
          if (!onReadyHook) resolve();
        };
        s.onerror = () => reject(new Error("Не удалось загрузить видеоплеер"));
        document.head.appendChild(s);
      }),
    );
  }
  return scriptPromises.get(src)!;
}

const SAVE_EVERY_MS = 10_000;

export function VideoPlayer({
  lessonId,
  source,
  startAt,
  initialPercent,
  requiredPct,
  requireVideo,
  watched,
}: {
  lessonId: string;
  source: VideoSource;
  startAt: number;
  initialPercent: number;
  requiredPct: number;
  requireVideo: boolean;
  watched: boolean;
}) {
  const router = useRouter();
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [percent, setPercent] = useState(initialPercent);
  const [done, setDone] = useState(watched);
  const [resumeNote, setResumeNote] = useState(startAt > 5 ? startAt : 0);

  // mutable tracking state
  const st = useRef({
    last: -1,
    segStart: -1,
    ranges: [] as [number, number][],
    position: startAt,
    duration: 0,
    dirty: false,
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    let saver: ReturnType<typeof setInterval> | undefined;
    let destroy: (() => void) | undefined;
    const s = st.current;

    const tick = (t: number, playing: boolean) => {
      s.position = t;
      if (playing && s.last >= 0 && t >= s.last && t - s.last <= 3) {
        if (s.segStart < 0) s.segStart = s.last;
        s.dirty = true;
      } else if (s.segStart >= 0) {
        // seek or pause: close the open segment
        s.ranges.push([s.segStart, s.last]);
        s.segStart = -1;
      }
      s.last = playing ? t : -1;
    };

    const collect = () => {
      const ranges = [...s.ranges];
      if (s.segStart >= 0 && s.last > s.segStart) {
        ranges.push([s.segStart, s.last]);
        s.segStart = s.last;
      }
      s.ranges = [];
      return ranges;
    };

    const payload = () =>
      JSON.stringify({ lessonId, position: Math.floor(s.position), duration: Math.floor(s.duration), ranges: collect() });

    const save = async () => {
      if (!s.dirty && s.ranges.length === 0) return;
      s.dirty = false;
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload(),
          keepalive: true,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { percent: number; videoCompleted: boolean; justCompleted: boolean; justWatched: boolean };
        setPercent((p) => Math.max(p, data.percent));
        if (data.videoCompleted) setDone(true);
        if (data.justCompleted || data.justWatched) router.refresh();
      } catch {
        /* offline — will retry on the next tick */
      }
    };

    const flush = () => {
      if (!s.dirty && s.ranges.length === 0 && s.segStart < 0) return;
      s.dirty = false;
      navigator.sendBeacon?.("/api/progress", new Blob([payload()], { type: "application/json" }));
    };
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);

    (async () => {
      try {
        const mount = document.createElement("div");
        mount.className = "size-full";
        host.replaceChildren(mount);
        if (source.provider === "youtube") {
          await loadScript(
            "https://www.youtube.com/iframe_api",
            () => Boolean(window.YT?.Player),
            (resolve) => {
              const prev = window.onYouTubeIframeAPIReady;
              window.onYouTubeIframeAPIReady = () => {
                prev?.();
                resolve();
              };
            },
          );
          if (cancelled) return;
          const player = new window.YT!.Player(mount, {
            videoId: source.id,
            width: "100%",
            height: "100%",
            playerVars: { start: Math.floor(startAt), rel: 0, modestbranding: 1, playsinline: 1, enablejsapi: 1 },
            events: {
              onReady: () => {
                s.duration = player.getDuration() || 0;
              },
            },
          });
          timer = setInterval(() => {
            try {
              const playing = player.getPlayerState?.() === window.YT!.PlayerState.PLAYING;
              const t = player.getCurrentTime?.() ?? 0;
              s.duration = player.getDuration?.() || s.duration;
              tick(t, playing);
            } catch {
              /* player not ready yet */
            }
          }, 1000);
          destroy = () => player.destroy();
        } else {
          await loadScript("https://player.vimeo.com/api/player.js", () => Boolean(window.Vimeo?.Player));
          if (cancelled) return;
          const url = `https://player.vimeo.com/video/${source.id}${source.hash ? `?h=${source.hash}` : ""}`;
          const player = new window.Vimeo!.Player(mount, { url, responsive: true, playsinline: true, dnt: true });
          let playing = false;
          player.on("play", () => (playing = true));
          player.on("pause", () => {
            playing = false;
            tick(s.position, false);
          });
          player.on("ended", () => {
            playing = false;
            tick(s.position, false);
            void save();
          });
          player.on("timeupdate", (d) => {
            s.duration = d.duration || s.duration;
            tick(d.seconds, playing);
          });
          player.getDuration().then((d) => (s.duration = d)).catch(() => {});
          if (startAt > 0) player.setCurrentTime(startAt).catch(() => {});
          destroy = () => void player.destroy();
        }
        saver = setInterval(save, SAVE_EVERY_MS);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка видеоплеера");
      }
    })();

    return () => {
      cancelled = true;
      flush();
      clearInterval(timer);
      clearInterval(saver);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, source.provider, source.id]);

  useEffect(() => {
    if (!resumeNote) return;
    const t = setTimeout(() => setResumeNote(0), 6000);
    return () => clearTimeout(t);
  }, [resumeNote]);

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow-sm [&_iframe]:absolute [&_iframe]:inset-0 [&_iframe]:size-full">
        <div ref={hostRef} className="absolute inset-0" />
        {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">{error}</div>}
        {resumeNote > 0 && (
          <div className="pointer-events-none absolute top-3 left-3 rounded-lg bg-black/70 px-3 py-1.5 text-xs text-white">
            Продолжаем с {formatClock(resumeNote)}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex min-w-48 flex-1 items-center gap-2">
          <span>Просмотрено {percent}%</span>
          <div className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div className={`h-full ${done ? "bg-brand-600" : "bg-brand-400"}`} style={{ width: `${percent}%` }} />
          </div>
        </div>
        {requireVideo &&
          (done ? (
            <span className="font-medium text-brand-700">✓ Видео просмотрено</span>
          ) : (
            <span>Для завершения урока посмотрите не менее {requiredPct}% видео</span>
          ))}
      </div>
    </div>
  );
}
