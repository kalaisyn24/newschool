import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "os_session";
const PRIVATE_PREFIXES = ["/learn", "/admin", "/support"];

/** Canonical origin of the site (APP_URL), e.g. https://example.kz */
const canonical = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL) : null;
  } catch {
    return null;
  }
})();

/** Old hosts (e.g. the former subdomain) that are permanently redirected to APP_URL. */
const legacyHosts = new Set(
  (process.env.REDIRECT_HOSTS ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

function requestHost(request: NextRequest) {
  const raw = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

/**
 * 1. Requests to a legacy host are redirected (301/308) to the same path on APP_URL.
 * 2. Optimistic auth check: bounce visitors without a session cookie away from
 *    private areas. Real authorization happens in the Data Access Layer (lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (canonical && legacyHosts.size && legacyHosts.has(requestHost(request))) {
    const target = new URL(pathname + search, canonical);
    // 308 keeps the method and body (form posts), GET/HEAD get a classic 301
    const status = request.method === "GET" || request.method === "HEAD" ? 301 : 308;
    return NextResponse.redirect(target, status);
  }

  const isPrivate = PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPrivate && !request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // every request, so that the whole legacy host (including assets) is redirected
  matcher: ["/:path*"],
};
