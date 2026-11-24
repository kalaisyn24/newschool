import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, Field, NameFields, SubmitButton } from "@/components/forms";
import { register } from "../actions";

export const metadata: Metadata = { title: "Регистрация" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900">Создать аккаунт</h1>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="link">
          Войдите
        </Link>
      </p>
      <ActionForm action={register} className="space-y-4">
        <NameFields />
        <p className="-mt-2 text-xs text-slate-500">Укажите как в документах — так имя будет написано в сертификате.</p>
        <Field label="E-mail">
          <input name="email" type="email" autoComplete="email" required className="input" placeholder="you@example.com" />
        </Field>
        <Field label="Пароль" hint="Не менее 8 символов, буквы и цифры">
          <input name="password" type="password" autoComplete="new-password" required minLength={8} className="input" />
        </Field>
        <Field label="Повторите пароль">
          <input name="password2" type="password" autoComplete="new-password" required className="input" />
        </Field>
        <label className="flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="agree" required className="mt-0.5 size-4 accent-brand-600" />
          <span>Я согласен с условиями использования и обработкой персональных данных</span>
        </label>
        <SubmitButton className="btn-primary w-full" pendingText="Создаём аккаунт…">
          Зарегистрироваться
        </SubmitButton>
      </ActionForm>
    </>
  );
}
