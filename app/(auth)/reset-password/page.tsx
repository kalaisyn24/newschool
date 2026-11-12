import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { Alert, Skeleton } from "@/components/ui";
import { peekToken } from "@/lib/tokens";
import { resetPassword } from "../actions";

export const metadata: Metadata = { title: "Новый пароль" };

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900">Новый пароль</h1>
      <Suspense fallback={<Skeleton className="h-48" />}>
        <ResetForm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ResetForm({ searchParams }: { searchParams: PageProps<"/reset-password">["searchParams"] }) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : "";
  const valid = await peekToken(token, "RESET_PASSWORD");
  if (!valid) {
    return (
      <div className="space-y-4">
        <Alert tone="red">Ссылка недействительна или срок её действия истёк.</Alert>
        <Link href="/forgot-password" className="btn-primary w-full">
          Запросить новую ссылку
        </Link>
      </div>
    );
  }
  return (
    <ActionForm action={resetPassword} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="Новый пароль" hint="Не менее 8 символов, буквы и цифры">
        <input name="password" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <Field label="Повторите пароль">
        <input name="password2" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Сохраняем…">
        Сохранить пароль
      </SubmitButton>
    </ActionForm>
  );
}
