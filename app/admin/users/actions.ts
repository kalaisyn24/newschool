"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";
import { bool, fromZod, str, type ActionState } from "@/lib/action-state";
import { sendPasswordResetEmail } from "@/lib/tokens";
import { logActivity, notify } from "@/lib/activity";
import { recomputeCourse } from "@/lib/learning";

const roleSchema = z.enum(["STUDENT", "ADMIN", "SUPPORT"]);

export async function createUser(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, password: passwordSchema, role: roleSchema })
    .safeParse({ name: str(fd, "name"), email: str(fd, "email"), password: fd.get("password") ?? "", role: str(fd, "role") });
  if (!parsed.success) return fromZod(parsed.error);
  if (await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } }))
    return { fieldErrors: { email: "Пользователь с таким e-mail уже существует" } };
  const user = await db.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 11),
      emailVerified: new Date(), // created by the administrator
    },
  });
  redirect(`/admin/users/${user.id}`);
}

export async function updateUser(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const parsed = z
    .object({ name: nameSchema, email: emailSchema, phone: z.string().max(40), role: roleSchema })
    .safeParse({ name: str(fd, "name"), email: str(fd, "email"), phone: str(fd, "phone"), role: str(fd, "role") });
  if (!parsed.success) return fromZod(parsed.error);
  const taken = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (taken && taken.id !== userId) return { fieldErrors: { email: "Этот e-mail уже используется" } };
  if (userId === admin.id && parsed.data.role !== "ADMIN") return { error: "Нельзя снять роль администратора с самого себя" };
  const current = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      role: parsed.data.role,
      emailVerified: bool(fd, "emailVerified") ? (current.emailVerified ?? new Date()) : null,
    },
  });
  refresh();
  return { ok: true, message: "Данные пользователя сохранены" };
}

export async function setBlocked(userId: string, blocked: boolean) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) return;
  await db.user.update({ where: { id: userId }, data: { blocked } });
  if (blocked) await db.session.deleteMany({ where: { userId } });
  refresh();
}

export async function deleteUser(userId: string) {
  const admin = await requireRole("ADMIN");
  if (userId === admin.id) return;
  await db.user.delete({ where: { id: userId } });
  redirect("/admin/users");
}

export async function sendResetLink(userId: string, _: ActionState, _fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await sendPasswordResetEmail(user);
  return { ok: true, message: `Ссылка для восстановления отправлена на ${user.email}` };
}

export async function setPassword(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const parsed = passwordSchema.safeParse(fd.get("password") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(parsed.data, 11) } });
  await db.session.deleteMany({ where: { userId } });
  await logActivity(userId, "password_changed", "Пароль задан администратором");
  return { ok: true, message: "Новый пароль установлен, все сеансы пользователя завершены" };
}

/* ---------- course access ---------- */

export async function grantAccess(userId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireRole("ADMIN");
  const courseId = str(fd, "courseId");
  const until = str(fd, "expiresAt");
  if (!courseId) return { error: "Выберите курс" };
  const course = await db.course.findUnique({ where: { id: courseId }, select: { title: true } });
  if (!course) return { error: "Курс не найден" };
  const expiresAt = until ? new Date(`${until}T23:59:59`) : null;
  await db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, grantedById: admin.id, expiresAt },
    update: { status: "ACTIVE", grantedById: admin.id, expiresAt },
  });
  await logActivity(userId, "access_granted", course.title, `/learn/courses/${courseId}`);
  await notify(userId, `Вам открыт доступ к курсу «${course.title}»`, undefined, `/learn/courses/${courseId}`);
  refresh();
  return { ok: true, message: `Доступ к курсу «${course.title}» открыт` };
}

export async function revokeAccess(userId: string, courseId: string) {
  await requireRole("ADMIN");
  const e = await db.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { status: "REVOKED" },
    include: { course: { select: { title: true } } },
  });
  await logActivity(userId, "access_revoked", e.course.title);
  refresh();
}

export async function restoreAccess(userId: string, courseId: string) {
  await requireRole("ADMIN");
  const e = await db.enrollment.update({
    where: { userId_courseId: { userId, courseId } },
    data: { status: "ACTIVE", expiresAt: null },
    include: { course: { select: { title: true } } },
  });
  await logActivity(userId, "access_granted", e.course.title);
  await notify(userId, `Доступ к курсу «${e.course.title}» восстановлен`, undefined, `/learn/courses/${courseId}`);
  refresh();
}

/* ---------- progress overrides ---------- */

export async function resetTestAttempts(userId: string, lessonId: string) {
  await requireRole("ADMIN");
  await db.testAttempt.deleteMany({ where: { userId, test: { lessonId } } });
  refresh();
}

export async function markLessonComplete(userId: string, lessonId: string) {
  await requireRole("ADMIN");
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId, completedAt: new Date(), videoCompleted: true, testPassed: true },
    update: { completedAt: new Date(), videoCompleted: true, testPassed: true },
  });
  await recomputeCourse(userId, lesson.module.courseId);
  refresh();
}

export async function resetLessonProgress(userId: string, lessonId: string) {
  await requireRole("ADMIN");
  const lesson = await db.lesson.findUniqueOrThrow({ where: { id: lessonId }, select: { module: { select: { courseId: true } } } });
  await db.lessonProgress.deleteMany({ where: { userId, lessonId } });
  await db.testAttempt.deleteMany({ where: { userId, test: { lessonId } } });
  await db.enrollment.updateMany({ where: { userId, courseId: lesson.module.courseId }, data: { completedAt: null } });
  refresh();
}
