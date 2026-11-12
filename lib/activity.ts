import "server-only";
import { db } from "@/lib/db";

export async function logActivity(userId: string, action: string, details?: string, link?: string) {
  await db.activityLog
    .create({ data: { userId, action, details: details?.slice(0, 500), link } })
    .catch(() => {});
}

export async function notify(userId: string, title: string, body?: string, link?: string) {
  await db.notification.create({ data: { userId, title, body, link } });
}
