"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroyCurrentSession } from "@/lib/session";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { consumeToken, sendPasswordResetEmail, sendVerificationEmail } from "@/lib/tokens";
import { emailSchema, passwordSchema } from "@/lib/validation";
import { fromZod, str, type ActionState } from "@/lib/action-state";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? "local").trim();
}

function safeNext(next: string) {
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

const personNamePart = (what: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/\s+/g, " "))
    .pipe(z.string().min(1, `Укажите ${what}`).max(60, "Слишком длинное значение"));

const registerSchema = z
  .object({
    firstName: personNamePart("имя"),
    lastName: personNamePart("фамилию"),
    email: emailSchema,
    password: passwordSchema,
    password2: z.string(),
    agree: z.literal("on", { error: "Необходимо согласие с условиями" }),
  })
  .refine((d) => d.password === d.password2, { message: "Пароли не совпадают", path: ["password2"] });

export async function register(_: ActionState, fd: FormData): Promise<ActionState> {
  const rl = rateLimit(`register:${await clientIp()}`, 10, 60 * 60e3);
  if (!rl.ok) return { error: "Слишком много попыток регистрации. Попробуйте позже." };

  const parsed = registerSchema.safeParse({
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: str(fd, "email"),
    password: fd.get("password") ?? "",
    password2: fd.get("password2") ?? "",
    agree: fd.get("agree") ?? undefined,
  });
  if (!parsed.success) return fromZod(parsed.error);
  const { firstName, lastName, email, password } = parsed.data;
  const name = `${firstName} ${lastName}`;

  const exists = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { fieldErrors: { email: "Пользователь с таким e-mail уже зарегистрирован" } };

  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 11) },
  });
  await logActivity(user.id, "registered");
  await db.notification.create({
    data: {
      userId: user.id,
      title: "Добро пожаловать в PrideX!",
      body: "Здесь будут появляться уведомления о курсах, тестах и ответах поддержки.",
    },
  });
  await sendVerificationEmail(user);
  await createSession(user.id);
  redirect("/verify-email");
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  const next = safeNext(str(fd, "next"));
  if (!email || !password) return { error: "Введите e-mail и пароль" };

  const key = `login:${email}:${await clientIp()}`;
  const rl = rateLimit(key, 8, 15 * 60e3);
  if (!rl.ok) return { error: `Слишком много попыток входа. Повторите через ${Math.ceil(rl.retryAfterSec / 60)} мин.` };

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { error: "Неверный e-mail или пароль" };
  if (user.blocked) return { error: "Ваш аккаунт заблокирован. Обратитесь в поддержку школы." };

  resetRateLimit(key);
  await createSession(user.id);
  await logActivity(user.id, "login");
  if (!user.emailVerified) redirect("/verify-email");
  redirect(next || homeFor(user.role));
}

export async function logout() {
  await destroyCurrentSession();
  redirect("/login");
}

export async function resendVerification(_: ActionState, _fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect(homeFor(user.role));
  const rl = rateLimit(`verify:${user.id}`, 3, 15 * 60e3);
  if (!rl.ok) return { error: "Письмо уже отправлено. Повторная отправка возможна через несколько минут." };
  await sendVerificationEmail(user);
  return { ok: true, message: `Письмо отправлено на ${user.email}` };
}

export async function forgotPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(str(fd, "email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const rl = rateLimit(`forgot:${parsed.data}`, 3, 15 * 60e3);
  if (rl.ok) {
    const user = await db.user.findUnique({ where: { email: parsed.data } });
    if (user && !user.blocked) await sendPasswordResetEmail(user);
  }
  // Same answer whether the account exists or not
  return {
    ok: true,
    message: "Если аккаунт с таким e-mail существует, мы отправили на него ссылку для восстановления пароля.",
  };
}

const resetSchema = z
  .object({ password: passwordSchema, password2: z.string() })
  .refine((d) => d.password === d.password2, { message: "Пароли не совпадают", path: ["password2"] });

export async function resetPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse({ password: fd.get("password") ?? "", password2: fd.get("password2") ?? "" });
  if (!parsed.success) return fromZod(parsed.error);
  const token = await consumeToken(str(fd, "token"), "RESET_PASSWORD");
  if (!token) return { error: "Ссылка недействительна или устарела. Запросите восстановление пароля ещё раз." };
  await db.user.update({
    where: { id: token.userId },
    // the link came to the mailbox, so the address is confirmed too
    data: { passwordHash: await bcrypt.hash(parsed.data.password, 11), emailVerified: new Date() },
  });
  await db.session.deleteMany({ where: { userId: token.userId } });
  await logActivity(token.userId, "password_reset");
  redirect("/login?reset=1");
}
