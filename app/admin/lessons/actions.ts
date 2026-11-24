"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { bool, int, str, type ActionState } from "@/lib/action-state";
import { parseVideoUrl } from "@/lib/video";
import { deleteUpload, MATERIAL_EXT, saveUpload } from "@/lib/storage";

export async function updateLesson(lessonId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const parsed = z
    .object({
      title: z.string().trim().min(2, "Введите название урока").max(200),
      summary: z.string().trim().max(500),
      content: z.string().max(100000),
      videoUrl: z.string().trim().max(500),
      assignment: z.string().max(20000),
    })
    .safeParse({
      title: str(fd, "title"),
      summary: str(fd, "summary"),
      content: str(fd, "content"),
      videoUrl: str(fd, "videoUrl"),
      assignment: str(fd, "assignment"),
    });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.videoUrl && !parseVideoUrl(d.videoUrl)) {
    return { fieldErrors: { videoUrl: "Ссылка не распознана. Укажите ссылку на видео YouTube или Vimeo." } };
  }
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, include: { module: true } });
  let moduleId = str(fd, "moduleId") || lesson.moduleId;
  if (moduleId !== lesson.moduleId) {
    const target = await db.module.findUnique({ where: { id: moduleId } });
    if (!target || target.courseId !== lesson.module.courseId) moduleId = lesson.moduleId;
  }
  const minutes = int(fd, "durationMin", 0);
  const seconds = int(fd, "durationSec", 0);
  const pct = Math.min(100, Math.max(1, int(fd, "requiredWatchPct", 90)));
  let position = lesson.position;
  if (moduleId !== lesson.moduleId) {
    const last = await db.lesson.findFirst({ where: { moduleId }, orderBy: { position: "desc" } });
    position = (last?.position ?? -1) + 1;
  }
  await db.lesson.update({
    where: { id: lessonId },
    data: {
      title: d.title,
      summary: d.summary || null,
      content: d.content.trim() || null,
      videoUrl: d.videoUrl || null,
      durationSec: Math.max(0, minutes * 60 + seconds),
      requireVideo: bool(fd, "requireVideo"),
      requiredWatchPct: pct,
      assignment: d.assignment.trim() || null,
      requireAssignment: bool(fd, "requireAssignment"),
      published: bool(fd, "published"),
      moduleId,
      position,
    },
  });
  refresh();
  return { ok: true, message: "Урок сохранён" };
}

/* ---------- materials ---------- */

export async function addMaterial(lessonId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const file = fd.get("file");
  const url = str(fd, "url");
  let title = str(fd, "title");
  if (file instanceof File && file.size > 0) {
    if (file.size > 50 * 1024 * 1024) return { error: "Файл больше 50 МБ" };
    try {
      const saved = await saveUpload(file, "materials", MATERIAL_EXT);
      if (!title) title = file.name.replace(/\.[^.]+$/, "");
      await db.lessonMaterial.create({
        data: { lessonId, title: title.slice(0, 200), storageKey: saved.key, mimeType: saved.mimeType, size: saved.size },
      });
    } catch (e) {
      return { error: (e as Error).message };
    }
  } else if (url) {
    if (!/^https?:\/\//i.test(url)) return { error: "Ссылка должна начинаться с http:// или https://" };
    await db.lessonMaterial.create({ data: { lessonId, title: (title || url).slice(0, 200), externalUrl: url } });
  } else {
    return { error: "Выберите файл или укажите ссылку" };
  }
  refresh();
  return { ok: true, message: "Материал добавлен" };
}

export async function deleteMaterial(materialId: string) {
  await requireRole("ADMIN");
  const m = await db.lessonMaterial.findUnique({ where: { id: materialId } });
  if (!m) return;
  await db.lessonMaterial.delete({ where: { id: materialId } });
  await deleteUpload(m.storageKey);
  refresh();
}

/* ---------- test ---------- */

export async function saveTestSettings(lessonId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const passingScore = Math.min(100, Math.max(1, int(fd, "passingScore", 70)));
  // Attempts are limited by the common retake rule (lib/test-attempts.ts), not per test.
  const data = { passingScore, required: bool(fd, "required"), showAnswers: bool(fd, "showAnswers") };
  await db.test.upsert({ where: { lessonId }, create: { lessonId, ...data }, update: data });
  refresh();
  return { ok: true, message: "Настройки теста сохранены" };
}

export async function deleteTest(lessonId: string) {
  await requireRole("ADMIN");
  await db.test.deleteMany({ where: { lessonId } });
  refresh();
}

const questionSchema = z
  .object({
    id: z.string().optional(),
    text: z.string().trim().min(2, "Введите текст вопроса").max(2000),
    multiple: z.boolean(),
    options: z
      .array(z.object({ text: z.string().trim().min(1, "Заполните все варианты ответа").max(500), isCorrect: z.boolean() }))
      .min(2, "Нужно минимум 2 варианта ответа")
      .max(12, "Не больше 12 вариантов"),
  })
  .refine((q) => q.options.some((o) => o.isCorrect), { message: "Отметьте хотя бы один правильный ответ" })
  .refine((q) => q.multiple || q.options.filter((o) => o.isCorrect).length === 1, {
    message: "В вопросе с одним ответом должен быть ровно один правильный вариант",
  });

export type QuestionInput = z.input<typeof questionSchema>;

export async function saveQuestion(testId: string, input: QuestionInput): Promise<{ error?: string; ok?: boolean }> {
  await requireRole("ADMIN");
  const parsed = questionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const q = parsed.data;
  const options = q.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, position: i }));
  if (q.id) {
    const existing = await db.question.findUnique({ where: { id: q.id } });
    if (!existing || existing.testId !== testId) return { error: "Вопрос не найден" };
    await db.$transaction([
      db.answerOption.deleteMany({ where: { questionId: q.id } }),
      db.question.update({ where: { id: q.id }, data: { text: q.text, multiple: q.multiple, options: { create: options } } }),
    ]);
  } else {
    const last = await db.question.findFirst({ where: { testId }, orderBy: { position: "desc" } });
    await db.question.create({
      data: { testId, text: q.text, multiple: q.multiple, position: (last?.position ?? -1) + 1, options: { create: options } },
    });
  }
  refresh();
  return { ok: true };
}

export async function deleteQuestion(questionId: string) {
  await requireRole("ADMIN");
  await db.question.delete({ where: { id: questionId } });
  refresh();
}

export async function moveQuestion(questionId: string, dir: -1 | 1) {
  await requireRole("ADMIN");
  const q = await db.question.findUniqueOrThrow({ where: { id: questionId } });
  const list = await db.question.findMany({ where: { testId: q.testId }, orderBy: { position: "asc" } });
  const i = list.findIndex((x) => x.id === questionId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((x, k) => db.question.update({ where: { id: x.id }, data: { position: k } })));
  refresh();
}
