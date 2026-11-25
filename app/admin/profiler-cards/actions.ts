"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { logActivity, notify } from "@/lib/activity";
import { deleteUpload, saveUpload } from "@/lib/storage";

const MAX_SIZE = 20 * 1024 * 1024;
const STUDENT_PAGE = "/learn/profiler-card";

/** Admin uploads (or replaces) the PDF of a profiler ID card; the student is notified. */
export async function uploadProfilerCard(cardId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите PDF-файл удостоверения" };
  if (file.size > MAX_SIZE) return { error: "Файл больше 20 МБ" };
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  if (head !== "%PDF-") return { error: "Файл не является PDF-документом" };

  const card = await db.profilerCard.findUnique({ where: { id: cardId }, include: { course: { select: { title: true } } } });
  if (!card) return { error: "Удостоверение не найдено" };

  let saved;
  try {
    saved = await saveUpload(file, "profiler-cards", ["pdf"]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить файл" };
  }
  const firstIssue = !card.issuedAt;
  await db.profilerCard.update({
    where: { id: cardId },
    data: { fileKey: saved.key, fileSize: saved.size, issuedAt: card.issuedAt ?? new Date() },
  });
  await deleteUpload(card.fileKey);

  await notify(
    card.userId,
    firstIssue ? "Вы получили удостоверение профайлера" : "Удостоверение профайлера обновлено",
    firstIssue
      ? `Поздравляем! Удостоверение профайлера по курсу «${card.course.title}» доступно для просмотра и скачивания.`
      : "Администратор загрузил новую версию вашего удостоверения.",
    STUDENT_PAGE,
  );
  if (firstIssue) await logActivity(card.userId, "profiler_card_issued", card.course.title, STUDENT_PAGE);
  refresh();
  return { ok: true, message: firstIssue ? "Удостоверение загружено, студент уведомлён" : "Файл удостоверения заменён" };
}

/**
 * Adds a student who completed the course earlier (e.g. imported from GetCourse)
 * to the "waiting for a profiler ID card" list.
 */
export async function addProfilerCard(userId: string, courseId: string, _: ActionState, _fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { completedAt: true },
  });
  if (!enrollment?.completedAt) return { error: "Студент ещё не завершил курс" };
  await db.profilerCard.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId },
    update: {},
  });
  refresh();
  return { ok: true, message: "Добавлено в «Удостоверения профайлера» — загрузите PDF" };
}
