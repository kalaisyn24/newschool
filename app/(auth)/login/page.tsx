import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Alert } from "@/components/ui";
import { login } from "../actions";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Вход в личный кабинет</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Нет аккаунта?{" "}
        <Link href="/register" className="link">
          Зарегистрируйтесь
        </Link>
      </p>
      <Suspense fallback={<LoginForm next="" />}>
        <LoginWithParams searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginWithParams({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "";
  return (
    <>
      {sp.reset && (
        <div className="mb-4">
          <Alert tone="green">Пароль изменён. Войдите с новым паролем.</Alert>
        </div>
      )}
      {sp.verified && (
        <div className="mb-4">
          <Alert tone="green">E-mail подтверждён. Теперь можно войти.</Alert>
        </div>
      )}
      <LoginForm next={next} />
    </>
  );
}

function LoginForm({ next }: { next: string }) {
  return (
    <ActionForm action={login} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="E-mail">
        <input name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
      </Field>
      <Field label="Пароль">
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm link">
          Забыли пароль?
        </Link>
      </div>
      <SubmitButton className="btn-primary w-full" pendingText="Входим…">
        Войти
      </SubmitButton>
    </ActionForm>
  );
}
