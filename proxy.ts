import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "os_session";

/**
 * Optimistic check only: bounce visitors without a session cookie away from
 * private areas. Real authorization happens in the Data Access Layer (lib/auth.ts).
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/learn/:path*", "/admin/:path*", "/support/:path*"],
};
