import "server-only";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth";

/** Number of items waiting for attention, keyed by the menu item href. */
export async function getNavCounters(user: CurrentUser): Promise<Record<string, number>> {
  const notifications = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const counters: Record<string, number> = { "/learn/notifications": notifications };

  if (user.role === "STUDENT") {
    counters["/learn/support"] = await db.conversation.count({ where: { studentId: user.id, unreadByStudent: true } });
    return counters;
  }

  const isAdmin = user.role === "ADMIN";
  const [assignments, support, certificates] = await Promise.all([
    db.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
    db.conversation.count({ where: { status: "OPEN", unreadByStaff: true } }),
    isAdmin ? db.certificate.count({ where: { issuedAt: null } }) : 0,
  ]);
  counters["/support"] = support;
  counters["/support/assignments"] = assignments;
  if (isAdmin) {
    counters["/admin/assignments"] = assignments;
    counters["/admin/certificates"] = certificates;
    counters["/admin/notifications"] = notifications;
  }
  return counters;
}
