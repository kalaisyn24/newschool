import "server-only";
import { cookies, headers } from "next/headers";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

export const SESSION_COOKIE = "os_session";
const SESSION_TTL_DAYS = 30;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 864e5);
  const h = await headers();
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      userAgent: h.get("user-agent")?.slice(0, 255) ?? null,
      ip: (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim().slice(0, 64) || null,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Returns the session row + user for the current request cookie, or null. */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Database access is request-time work: keep it out of (runtime) prerenders.
  await connection();
  const id = sha256(token);
  const session = await db.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return null;
  const now = Date.now();
  if (session.expiresAt.getTime() < now || session.user.blocked) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (now - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    await db.$transaction([
      db.session.update({ where: { id }, data: { lastUsedAt: new Date(now) } }),
      db.user.update({ where: { id: session.userId }, data: { lastSeenAt: new Date(now) } }),
    ]);
  }
  return session;
}

export async function destroyCurrentSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  store.delete(SESSION_COOKIE);
}

export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? sha256(token) : null;
}
