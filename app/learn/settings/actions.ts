"use server";

import bcrypt from "bcryptjs";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { currentSessionId } from "@/lib/session";
import { sendChangeEmail } from "@/lib/tokens";
import { emailSchema, firstNameSchema, joinName, optionalLastNameSchema, passwordSchema } from "@/lib/validation";
import { fromZod, str, type ActionState } from "@/lib/action-state";
import { logActivity } from "@/lib/activity";
import { rateLimit } from "@/lib/rate-limit";

export async function updateProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({ firstName: firstNameSchema, lastName: optionalLastNameSchema, phone: z.string().trim().max(40, "Слишком длинный телефон") })
    .safeParse({ firstName: str(fd, "firstName"), lastName: str(fd, "lastName"), phone: str(fd, "phone") });
  if (!parsed.success) return fromZod(parsed.error);
  await db.user.update({
    where: { id: user.id },
    data: { name: joinName(parsed.data.firstName, parsed.data.lastName), phone: parsed.data.phone || null },
  });
  refresh();
  return { ok: true, message: "Профиль сохранён" };
}

export async function changePassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const current = String(fd.get("current") ?? "");
  const parsed = z
    .object({ password: passwordSchema, password2: z.string() })
    .refine((d) => d.password === d.password2, { message: "Пароли не совпадают", path: ["password2"] })
    .safeParse({ password: fd.get("password") ?? "", password2: fd.get("password2") ?? "" });
  if (!parsed.success) return fromZod(parsed.error);
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(current, row.passwordHash))) return { fieldErrors: { current: "Текущий пароль указан неверно" } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data.password, 11) } });
  // sign out everywhere else
  const sid = await currentSessionId();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: sid ?? "" } } });
  await logActivity(user.id, "password_changed");
  return { ok: true, message: "Пароль изменён. Остальные сеансы завершены." };
}

export async function requestEmailChange(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = emailSchema.safeParse(str(fd, "email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message } };
  const email = parsed.data;
  if (email === user.email) return { fieldErrors: { email: "Это ваш текущий e-mail" } };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(String(fd.get("password") ?? ""), row.passwordHash)))
    return { fieldErrors: { password: "Пароль указан неверно" } };
  if (await db.user.findUnique({ where: { email }, select: { id: true } }))
    return { fieldErrors: { email: "Этот e-mail уже используется" } };
  if (!rateLimit(`email-change:${user.id}`, 3, 30 * 60e3).ok) return { error: "Слишком много запросов. Попробуйте позже." };
  await sendChangeEmail(user, email);
  return { ok: true, message: `Мы отправили ссылку подтверждения на ${email}. E-mail изменится после перехода по ней.` };
}

export async function terminateOtherSessions() {
  const user = await requireUser();
  const sid = await currentSessionId();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: sid ?? "" } } });
  refresh();
}
