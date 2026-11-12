import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentSessionId } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { formatDateTime } from "@/lib/format";
import { logout } from "@/app/(auth)/actions";
import { changePassword, requestEmailChange, terminateOtherSessions, updateProfile } from "./actions";

export const metadata: Metadata = { title: "Настройки профиля" };

function describeAgent(ua: string | null) {
  if (!ua) return "Неизвестное устройство";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /YaBrowser/.test(ua) ? "Яндекс Браузер" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Браузер";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return `${browser}${os ? ` · ${os}` : ""}`;
}

export default async function SettingsPage() {
  const me = await requireUser();
  const [user, sessions, sid] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: me.id } }),
    db.session.findMany({ where: { userId: me.id, expiresAt: { gt: new Date() } }, orderBy: { lastUsedAt: "desc" } }),
    currentSessionId(),
  ]);

  return (
    <>
      <PageHeader title="Настройки профиля" subtitle="Личные данные, безопасность и активные сеансы" />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Личные данные</h2>
          <ActionForm action={updateProfile} className="space-y-4">
            <Field label="Имя и фамилия">
              <input name="name" defaultValue={user.name} required className="input" />
            </Field>
            <Field label="Телефон" hint="Необязательно">
              <input name="phone" defaultValue={user.phone ?? ""} className="input" placeholder="+7 ___ ___-__-__" />
            </Field>
            <SubmitButton pendingText="Сохраняем…">Сохранить</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-6">
          <h2 className="mb-1 font-semibold text-slate-900">E-mail</h2>
          <p className="mb-4 text-sm text-slate-500">
            Текущий: <b className="text-slate-800">{user.email}</b>
          </p>
          <ActionForm action={requestEmailChange} resetOnSuccess className="space-y-4">
            <Field label="Новый e-mail">
              <input name="email" type="email" required className="input" />
            </Field>
            <Field label="Текущий пароль" hint="Для подтверждения, что это вы">
              <input name="password" type="password" autoComplete="current-password" required className="input" />
            </Field>
            <SubmitButton pendingText="Отправляем…">Сменить e-mail</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Смена пароля</h2>
          <ActionForm action={changePassword} resetOnSuccess className="space-y-4">
            <Field label="Текущий пароль">
              <input name="current" type="password" autoComplete="current-password" required className="input" />
            </Field>
            <Field label="Новый пароль" hint="Не менее 8 символов, буквы и цифры">
              <input name="password" type="password" autoComplete="new-password" required className="input" />
            </Field>
            <Field label="Повторите новый пароль">
              <input name="password2" type="password" autoComplete="new-password" required className="input" />
            </Field>
            <SubmitButton pendingText="Сохраняем…">Изменить пароль</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Активные сеансы</h2>
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{describeAgent(s.userAgent)}</p>
                  <p className="text-xs text-slate-500">
                    {s.ip ? `${s.ip} · ` : ""}активность {formatDateTime(s.lastUsedAt)}
                  </p>
                </div>
                {s.id === sid && <span className="text-xs font-medium text-emerald-600">Текущий</span>}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {sessions.length > 1 && (
              <form action={terminateOtherSessions}>
                <SubmitButton className="btn-secondary">Завершить другие сеансы</SubmitButton>
              </form>
            )}
            <form action={logout}>
              <SubmitButton className="btn-danger">Выйти из аккаунта</SubmitButton>
            </form>
          </div>
        </section>
      </div>
    </>
  );
}
