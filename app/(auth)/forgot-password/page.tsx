import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { forgotPassword } from "../actions";

export const metadata: Metadata = { title: "Восстановление пароля" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Восстановление пароля</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Укажите e-mail, с которым вы регистрировались, — мы пришлём ссылку для смены пароля.
      </p>
      <ActionForm action={forgotPassword} className="space-y-4">
        <Field label="E-mail">
          <input name="email" type="email" autoComplete="email" required className="input" />
        </Field>
        <SubmitButton className="btn-primary w-full" pendingText="Отправляем…">
          Отправить ссылку
        </SubmitButton>
      </ActionForm>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="link">
          ← Вернуться ко входу
        </Link>
      </p>
    </>
  );
}
