"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { str, type ActionState } from "@/lib/action-state";
import { notify } from "@/lib/activity";
import { recomputeLesson } from "@/lib/learning";

/** Review of a practical assignment — available to administrators and support staff. */
export async function reviewSubmission(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN", "SUPPORT");
  const decision = str(fd, "decision");
  if (decision !== "ACCEPTED" && decision !== "REJECTED") return { error: "Выберите решение" };
  // Only a submission that is still waiting can be reviewed (two reviewers may open it at once)
  const { count } = await db.assignmentSubmission.updateMany({
    where: { id, status: "SUBMITTED" },
    data: { status: decision, feedback: str(fd, "feedback") || null, reviewedAt: new Date() },
  });
  if (count === 0) {
    refresh();
    return { error: "Это решение уже проверено другим сотрудником" };
  }
  const s = await db.assignmentSubmission.findUniqueOrThrow({
    where: { id },
    include: { lesson: { select: { title: true } } },
  });
  await notify(
    s.userId,
    decision === "ACCEPTED" ? `Задание принято: «${s.lesson.title}»` : `Задание возвращено на доработку: «${s.lesson.title}»`,
    s.feedback ?? undefined,
    `/learn/lessons/${s.lessonId}`,
  );
  await recomputeLesson(s.userId, s.lessonId);
  refresh();
  return { ok: true, message: decision === "ACCEPTED" ? "Решение принято" : "Возвращено на доработку" };
}
