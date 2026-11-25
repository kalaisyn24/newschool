import "server-only";
import { db } from "@/lib/db";
import { notifyAdmins } from "@/lib/activity";

export const PROFILER_CARD = "Удостоверение профайлера";

/**
 * Creates a pending profiler ID card (without a file) for a completed course and asks the admins
 * to upload the PDF. Idempotent; does nothing for courses without profiler ID cards.
 */
export async function requestProfilerCard(userId: string, courseId: string) {
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true, profilerCardEnabled: true } });
  if (!course?.profilerCardEnabled) return null;
  const existing = await db.profilerCard.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return existing;
  const card = await db.profilerCard.create({ data: { userId, courseId } });
  const student = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  await notifyAdmins(
    `Нужно удостоверение профайлера: ${student?.name ?? "студент"}`,
    `Студент ${student?.name ?? ""} (${student?.email ?? ""}) завершил курс «${course.title}». Загрузите PDF удостоверения профайлера.`,
    `/admin/profiler-cards`,
  );
  return card;
}
