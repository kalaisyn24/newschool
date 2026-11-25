"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { bool, int, str, type ActionState } from "@/lib/action-state";
import { deleteUpload, IMAGE_TYPES, keyFromMediaUrl, mediaUrl, saveUpload } from "@/lib/storage";
import { applyModuleSelection, readModuleSelection } from "@/lib/module-access";

const courseSchema = z.object({
  title: z.string().trim().min(3, "Название — минимум 3 символа").max(200),
  shortDescription: z.string().trim().min(5, "Добавьте краткое описание").max(500, "Краткое описание — до 500 символов"),
  description: z.string().trim().max(50000),
  objectives: z.string().trim().max(10000),
  teacherName: z.string().trim().max(160),
  teacherBio: z.string().trim().max(5000),
});

function readCourse(fd: FormData) {
  return courseSchema.safeParse({
    title: str(fd, "title"),
    shortDescription: str(fd, "shortDescription"),
    description: str(fd, "description"),
    objectives: str(fd, "objectives"),
    teacherName: str(fd, "teacherName"),
    teacherBio: str(fd, "teacherBio"),
  });
}

async function handleCover(fd: FormData, current: string | null) {
  const file = fd.get("cover");
  if (bool(fd, "removeCover")) {
    await deleteUpload(keyFromMediaUrl(current));
    return null;
  }
  if (file instanceof File && file.size > 0) {
    if (!IMAGE_TYPES.includes(file.type)) throw new Error("Обложка должна быть изображением JPG, PNG, WEBP или GIF");
    if (file.size > 5 * 1024 * 1024) throw new Error("Обложка должна быть не больше 5 МБ");
    const saved = await saveUpload(file, "covers", ["jpg", "jpeg", "png", "webp", "gif"]);
    await deleteUpload(keyFromMediaUrl(current));
    return mediaUrl(saved.key);
  }
  return current;
}

export async function createCourse(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const parsed = readCourse(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  let coverUrl: string | null;
  try {
    coverUrl = await handleCover(fd, null);
  } catch (e) {
    return { error: (e as Error).message };
  }
  const course = await db.course.create({
    data: {
      ...parsed.data,
      teacherName: parsed.data.teacherName || null,
      teacherBio: parsed.data.teacherBio || null,
      coverUrl,
      modules: { create: { title: "Модуль 1", position: 0 } },
    },
  });
  redirect(`/admin/courses/${course.id}`);
}

export async function updateCourse(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const parsed = readCourse(fd);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId } });
  let coverUrl: string | null;
  try {
    coverUrl = await handleCover(fd, course.coverUrl);
  } catch (e) {
    return { error: (e as Error).message };
  }
  await db.course.update({
    where: { id: courseId },
    data: {
      ...parsed.data,
      teacherName: parsed.data.teacherName || null,
      teacherBio: parsed.data.teacherBio || null,
      coverUrl,
      published: bool(fd, "published"),
      access: str(fd, "access") === "OPEN" ? "OPEN" : "BY_GRANT",
      sequential: bool(fd, "sequential"),
      certificateEnabled: bool(fd, "certificateEnabled"),
      profilerCardEnabled: bool(fd, "profilerCardEnabled"),
      position: int(fd, "position", course.position),
    },
  });
  refresh();
  return { ok: true, message: "Курс сохранён" };
}

export async function deleteCourse(courseId: string) {
  await requireRole("ADMIN");
  const course = await db.course.findUnique({
    where: { id: courseId },
    include: { modules: { include: { lessons: { include: { materials: true } } } } },
  });
  if (!course) redirect("/admin/courses");
  await db.course.delete({ where: { id: courseId } });
  await deleteUpload(keyFromMediaUrl(course.coverUrl));
  for (const m of course.modules) for (const l of m.lessons) for (const f of l.materials) await deleteUpload(f.storageKey);
  redirect("/admin/courses");
}

/* ---------- modules ---------- */

export async function addModule(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const title = str(fd, "title");
  if (title.length < 2) return { error: "Введите название модуля" };
  const last = await db.module.findFirst({ where: { courseId }, orderBy: { position: "desc" } });
  await db.module.create({ data: { courseId, title, position: (last?.position ?? -1) + 1 } });
  refresh();
  return { ok: true };
}

export async function renameModule(moduleId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const title = str(fd, "title");
  if (title.length < 2) return { error: "Введите название модуля" };
  await db.module.update({ where: { id: moduleId }, data: { title } });
  refresh();
  return { ok: true };
}

export async function deleteModule(moduleId: string) {
  await requireRole("ADMIN");
  const m = await db.module.findUnique({ where: { id: moduleId }, include: { lessons: { include: { materials: true } } } });
  if (!m) return;
  await db.module.delete({ where: { id: moduleId } });
  for (const l of m.lessons) for (const f of l.materials) await deleteUpload(f.storageKey);
  refresh();
}

async function normalize<T extends { id: string }>(items: T[], update: (id: string, position: number) => Promise<unknown>) {
  await Promise.all(items.map((it, i) => update(it.id, i)));
}

export async function moveModule(moduleId: string, dir: -1 | 1) {
  await requireRole("ADMIN");
  const m = await db.module.findUniqueOrThrow({ where: { id: moduleId } });
  const list = await db.module.findMany({ where: { courseId: m.courseId }, orderBy: { position: "asc" } });
  const i = list.findIndex((x) => x.id === moduleId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await normalize(list, (id, position) => db.module.update({ where: { id }, data: { position } }));
  refresh();
}

/* ---------- lessons ---------- */

export async function addLesson(moduleId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const title = str(fd, "title");
  if (title.length < 2) return { error: "Введите название урока" };
  const last = await db.lesson.findFirst({ where: { moduleId }, orderBy: { position: "desc" } });
  const lesson = await db.lesson.create({ data: { moduleId, title, position: (last?.position ?? -1) + 1 } });
  redirect(`/admin/lessons/${lesson.id}`);
}

export async function moveLesson(lessonId: string, dir: -1 | 1) {
  await requireRole("ADMIN");
  const l = await db.lesson.findUniqueOrThrow({ where: { id: lessonId } });
  const list = await db.lesson.findMany({ where: { moduleId: l.moduleId }, orderBy: { position: "asc" } });
  const i = list.findIndex((x) => x.id === lessonId);
  const j = i + dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  await normalize(list, (id, position) => db.lesson.update({ where: { id }, data: { position } }));
  refresh();
}

export async function deleteLesson(lessonId: string, redirectTo?: string) {
  await requireRole("ADMIN");
  const l = await db.lesson.findUnique({ where: { id: lessonId }, include: { materials: true, module: true } });
  if (!l) return;
  await db.lesson.delete({ where: { id: lessonId } });
  for (const f of l.materials) await deleteUpload(f.storageKey);
  if (redirectTo) redirect(redirectTo);
  refresh();
}

/* ---------- students of a course ---------- */

export async function grantByEmail(courseId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const emails = str(fd, "emails")
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return { error: "Укажите e-mail" };
  const course = await db.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } });
  const sel = await readModuleSelection(fd, courseId);
  if ("error" in sel) return { error: sel.error };
  const users = await db.user.findMany({ where: { email: { in: emails } } });
  const missing = emails.filter((e) => !users.some((u) => u.email === e));
  let opened = 0;
  let changed = 0;
  for (const u of users) {
    const existing = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: u.id, courseId } },
      select: { status: true },
    });
    const enrollment = await db.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId } },
      create: { userId: u.id, courseId, grantedById: admin.id },
      update: { status: "ACTIVE", grantedById: admin.id },
    });
    // already active: only the set of modules changes (the student hears about newly opened modules)
    const wasActive = existing?.status === "ACTIVE";
    await applyModuleSelection(enrollment.id, sel, wasActive);
    const label = `${course.title}${sel.allModules ? "" : `: модулей ${sel.moduleIds.length}`}`;
    if (wasActive) {
      changed++;
      await db.activityLog.create({ data: { userId: u.id, action: "modules_changed", details: label } });
    } else {
      opened++;
      await db.notification.create({
        data: { userId: u.id, title: `Вам открыт доступ к курсу «${course.title}»`, link: `/learn/courses/${courseId}` },
      });
      await db.activityLog.create({ data: { userId: u.id, action: "access_granted", details: label } });
    }
  }
  refresh();
  const summary = `Доступ открыт: ${opened}` + (changed ? `, модули изменены у записанных ранее: ${changed}` : "");
  if (missing.length) return { error: `${summary}. Не найдены пользователи: ${missing.join(", ")}` };
  return { ok: true, message: summary };
}
