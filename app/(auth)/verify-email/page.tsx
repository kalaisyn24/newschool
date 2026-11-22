import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Alert, Skeleton } from "@/components/ui";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { logout, resendVerification } from "../actions";

export const metadata: Metadata = { title: "Подтверждение e-mail" };

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <Suspense fallback={<Skeleton className="h-48" />}>
      <VerifyContent searchParams={searchParams} />
    </Suspense>
  );
}

async function VerifyContent({ searchParams }: { searchParams: PageProps<"/verify-email">["searchParams"] }) {
  const sp = await searchParams;
  const raw = typeof sp.token === "string" ? sp.token : "";
  const user = await getCurrentUser();

  if (raw) {
    const token = await consumeToken(raw, "VERIFY_EMAIL");
    if (token) {
      await db.user.update({ where: { id: token.userId }, data: { emailVerified: new Date() } });
      await logActivity(token.userId, "email_verified");
      const loggedIn = user?.id === token.userId;
      return (
        <div className="space-y-4">
          <div className="grid size-14 place-items-center rounded-full bg-brand-100 text-2xl text-brand-800">✓</div>
          <h1 className="text-2xl font-semibold text-slate-900">E-mail подтверждён</h1>
          <p className="text-sm text-slate-500">Спасибо! Ваш аккаунт полностью активирован.</p>
          <Link href={loggedIn ? homeFor(user!.role) : "/login?verified=1"} className="btn-primary w-full">
            {loggedIn ? "Перейти в личный кабинет" : "Войти"}
          </Link>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Ссылка недействительна</h1>
        <Alert tone="red">Ссылка подтверждения устарела или уже была использована.</Alert>
        {user && !user.emailVerified && <ResendForm />}
        {!user && (
          <Link href="/login" className="btn-secondary w-full">
            Войти
          </Link>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">Подтверждение e-mail</h1>
        <p className="text-sm text-slate-500">Откройте ссылку из письма или войдите, чтобы отправить письмо повторно.</p>
        <Link href="/login" className="btn-primary w-full">
          Войти
        </Link>
      </div>
    );
  }

  if (user.emailVerified) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-slate-900">E-mail уже подтверждён</h1>
        <Link href={homeFor(user.role)} className="btn-primary w-full">
          В личный кабинет
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid size-14 place-items-center rounded-full bg-brand-50 text-2xl text-brand-700">✉</div>
      <h1 className="text-2xl font-semibold text-slate-900">Подтвердите e-mail</h1>
      <p className="text-sm text-slate-600">
        Мы отправили письмо со ссылкой на <b>{user.email}</b>. Перейдите по ней, чтобы открыть доступ к личному
        кабинету. Не забудьте проверить папку «Спам».
      </p>
      <ResendForm />
      <form action={logout}>
        <button className="btn-ghost w-full">Выйти из аккаунта</button>
      </form>
    </div>
  );
}

function ResendForm() {
  return (
    <ActionForm action={resendVerification}>
      <SubmitButton className="btn-secondary w-full" pendingText="Отправляем…">
        Отправить письмо ещё раз
      </SubmitButton>
    </ActionForm>
  );
}
