// Client-safe: parse YouTube / Vimeo links into provider ids.

export type VideoSource =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string; hash?: string };

export function parseVideoUrl(raw: string | null | undefined): VideoSource | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0];
    return id ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const v = url.searchParams.get("v");
    if (v) return { provider: "youtube", id: v };
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
    return m ? { provider: "youtube", id: m[1] } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    // vimeo.com/123456, vimeo.com/123456/abcdef (unlisted), player.vimeo.com/video/123456?h=abcdef
    const m = url.pathname.match(/(?:\/video)?\/(\d+)(?:\/([\da-f]+))?/);
    if (!m) return null;
    return { provider: "vimeo", id: m[1], hash: m[2] || url.searchParams.get("h") || undefined };
  }
  return null;
}
