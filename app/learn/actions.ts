"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireLearner } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getLessonAccess, recomputeLesson } from "@/lib/learning";
import { str, type ActionState } from "@/lib/action-state";
import { saveUpload } from "@/lib/storage";
import { ASSIGNMENT_FILE_EXT, ASSIGNMENT_FILE_MAX, ASSIGNMENT_FILE_TOO_BIG } from "@/lib/assignment-file";

/** Self-enrollment for courses with open access. */
export async function enroll(courseId: string) {
  const user = await requireLearner();
  const course = await db.course.findUnique({ where: { id: courseId } });
  if (!course || !course.published || course.access !== "OPEN") redirect("/learn/catalog");
  const existing = await db.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } });
  if (existing && existing.status === "REVOKED") redirect(`/learn/courses/${courseId}`); // access closed by admin
  if (!existing) {
    await db.enrollment.create({ data: { userId: user.id, courseId } });
    await logActivity(user.id, "enrolled", course.title, `/learn/courses/${courseId}`);
    await db.notification.create({
      data: { userId: user.id, title: `Вы записаны на курс «${course.title}»`, link: `/learn/courses/${courseId}` },
    });
  }
  redirect(`/learn/courses/${courseId}`);
}

/** Request access to a closed course — opens a support conversation. */
export async function requestAccess(courseId: string) {
  const user = await requireLearner();
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true, published: true } });
  if (!course?.published) redirect("/learn/catalog");
  const subject = `Запрос доступа к курсу «${course.title}»`;
  let conv = await db.conversation.findFirst({ where: { studentId: user.id, subject, status: "OPEN" } });
  if (!conv) {
    conv = await db.conversation.create({
      data: {
        subject,
        studentId: user.id,
        messages: {
          create: {
            senderId: user.id,
            body: `Здравствуйте! Прошу открыть мне доступ к курсу «${course.title}».`,
          },
        },
      },
    });
  }
  redirect(`/learn/support/${conv.id}`);
}

export async function submitAssignment(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireLearner();
  const lessonId = str(fd, "lessonId");
  const text = str(fd, "text");
  const raw = fd.get("file");
  const file = raw instanceof File && raw.size > 0 ? raw : null;
  if (file && file.size > ASSIGNMENT_FILE_MAX) return { error: ASSIGNMENT_FILE_TOO_BIG };
  if (!file && text.length < 5) return { error: "Опишите решение подробнее (минимум 5 символов) или прикрепите файл" };
  if (text.length > 20000) return { error: "Слишком длинный ответ" };
  const access = await getLessonAccess(user.id, lessonId);
  if (!access.ok) return { error: "Урок недоступен" };
  const lesson = await db.lesson.findUnique({ where: { id: lessonId }, select: { assignment: true, title: true } });
  if (!lesson?.assignment) return { error: "В этом уроке нет практического задания" };

  let saved: { key: string; size: number } | null = null;
  if (file) {
    try {
      saved = await saveUpload(file, "assignments", ASSIGNMENT_FILE_EXT);
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Не удалось сохранить файл" };
    }
  }
  await db.assignmentSubmission.create({
    data: {
      userId: user.id,
      lessonId,
      text,
      fileKey: saved?.key ?? null,
      fileName: file ? file.name.slice(0, 255) : null,
      fileSize: saved?.size ?? null,
    },
  });
  await logActivity(user.id, "assignment_submitted", lesson.title, `/learn/lessons/${lessonId}`);
  await recomputeLesson(user.id, lessonId);
  refresh();
  return { ok: true, message: "Решение отправлено на проверку" };
}

export async function markNotificationsRead() {
  const user = await requireLearner();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}
