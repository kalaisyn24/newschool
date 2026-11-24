import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseState, enrollmentIsActive } from "@/lib/learning";
import { Avatar, Badge, PageHeader, ProgressBar } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, SubmitButton } from "@/components/forms";
import { formatDate, formatDateTime } from "@/lib/format";
import { activityLabel } from "@/lib/activity-labels";
import { roleMeta } from "@/lib/roles";
import {
  deleteUser,
  grantAccess,
  completeCourseAndIssueCertificate,
  restoreAccess,
  revokeAccess,
  sendResetLink,
  setBlocked,
  setPassword,
  updateUser,
} from "../actions";

export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireRole("ADMIN");
  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: {
      enrollments: { include: { course: { select: { id: true, title: true, published: true } }, grantedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      activities: { orderBy: { createdAt: "desc" }, take: 40 },
      certificates: { select: { id: true, courseId: true, issuedAt: true, fileKey: true } },
      _count: { select: { sessions: true, testAttempts: true, conversations: true } },
    },
  });
  if (!user) notFound();
  const [courses, states] = await Promise.all([
    db.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    Promise.all(user.enrollments.map((e) => getCourseState(user.id, e.courseId))),
  ]);
  const enrolledIds = new Set(user.enrollments.filter((e) => e.status === "ACTIVE").map((e) => e.courseId));
  const isSelf = admin.id === user.id;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/users", label: "Пользователи" }}
        title={
          <span className="flex items-center gap-3">
            <Avatar name={user.name} size={44} />
            <span>
              {user.name}
              <span className="block text-sm font-normal text-slate-500">{user.email}</span>
            </span>
          </span>
        }
        actions={
          <>
            <Badge tone={roleMeta[user.role].tone}>{roleMeta[user.role].label}</Badge>
            {user.blocked ? <Badge tone="red">Заблокирован</Badge> : <Badge tone="green">Активен</Badge>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Курсы и прогресс</h2>
            {user.enrollments.length === 0 && <p className="mb-4 text-sm text-slate-500">У пользователя нет доступа ни к одному курсу.</p>}
            <div className="space-y-3">
              {user.enrollments.map((e, i) => {
                const st = states[i];
                const active = enrollmentIsActive(e);
                const cert = user.certificates.find((c) => c.courseId === e.courseId);
                return (
                  <div key={e.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/admin/users/${user.id}/courses/${e.courseId}`} className="font-medium text-slate-900 hover:text-brand-700">
                          {e.course.title}
                        </Link>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Доступ с {formatDate(e.createdAt)}
                          {e.grantedBy && ` · открыл ${e.grantedBy.name}`}
                          {e.expiresAt && ` · до ${formatDate(e.expiresAt)}`}
                          {e.lastAccessAt && ` · был ${formatDateTime(e.lastAccessAt)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.completedAt ? <Badge tone="green">Завершён {formatDate(e.completedAt)}</Badge> : null}
                        {!active && <Badge tone="red">{e.status === "REVOKED" ? "Доступ закрыт" : "Истёк"}</Badge>}
                      </div>
                    </div>
                    {st && (
                      <div className="mt-3 flex items-center gap-3">
                        <ProgressBar value={st.percent} size="sm" />
                        <span className="shrink-0 text-xs text-slate-500">{st.completedCount}/{st.total} · {st.percent}%</span>
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/admin/users/${user.id}/courses/${e.courseId}`} className="btn-secondary btn-sm">Подробный прогресс</Link>
                      {cert?.fileKey ? (
                        <a href={`/api/certificates/${cert.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                          Сертификат (PDF)
                        </a>
                      ) : (
                        <ActionForm action={completeCourseAndIssueCertificate.bind(null, user.id, e.courseId)}>
                          <ConfirmButton
                            className="btn-primary btn-sm"
                            message={`Отметить курс «${e.course.title}» пройденным и выдать сертификат на имя «${user.name}»?`}
                          >
                            Курс пройден + сертификат
                          </ConfirmButton>
                        </ActionForm>
                      )}
                      {active ? (
                        <form action={revokeAccess.bind(null, user.id, e.courseId)}>
                          <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Закрыть доступ к курсу? Прогресс сохранится.">Закрыть доступ</ConfirmButton>
                        </form>
                      ) : (
                        <form action={restoreAccess.bind(null, user.id, e.courseId)}>
                          <SubmitButton className="btn-ghost btn-sm text-emerald-700">Открыть доступ</SubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <ActionForm action={grantAccess.bind(null, user.id)} className="mt-5 rounded-xl bg-slate-50 p-4">
              <p className="mb-3 text-sm font-medium text-slate-800">Открыть доступ к курсу</p>
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-48 flex-1">
                  <span className="label text-xs">Курс</span>
                  <select name="courseId" className="input" required defaultValue="">
                    <option value="" disabled>Выберите курс…</option>
                    {courses.filter((c) => !enrolledIds.has(c.id)).map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label text-xs">Доступ до (необязательно)</span>
                  <input type="date" name="expiresAt" className="input" />
                </label>
                <SubmitButton>Открыть</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Активность</h2>
            {user.activities.length === 0 ? (
              <p className="text-sm text-slate-500">Нет записей</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {user.activities.map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span className="text-slate-700">
                      {activityLabel(a.action)}
                      {a.details && <span className="text-slate-500"> — {a.details}</span>}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-6">
            <h2 className="mb-4 font-semibold text-slate-900">Данные</h2>
            <ActionForm action={updateUser.bind(null, user.id)} className="space-y-3">
              <Field label="Имя"><input name="name" defaultValue={user.name} required className="input" /></Field>
              <Field label="E-mail"><input name="email" type="email" defaultValue={user.email} required className="input" /></Field>
              <Field label="Телефон"><input name="phone" defaultValue={user.phone ?? ""} className="input" /></Field>
              <Field label="Роль">
                <select name="role" defaultValue={user.role} className="input">
                  <option value="STUDENT">Студент</option>
                  <option value="SUPPORT">Техподдержка</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name="emailVerified" defaultChecked={Boolean(user.emailVerified)} className="size-4 accent-brand-600" />
                E-mail подтверждён
              </label>
              <SubmitButton>Сохранить</SubmitButton>
            </ActionForm>
            <dl className="mt-5 space-y-1.5 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <div className="flex justify-between"><dt>ID</dt><dd className="font-mono">{user.id}</dd></div>
              <div className="flex justify-between"><dt>Регистрация</dt><dd>{formatDateTime(user.createdAt)}</dd></div>
              <div className="flex justify-between"><dt>Последний визит</dt><dd>{formatDateTime(user.lastSeenAt)}</dd></div>
              <div className="flex justify-between"><dt>Активных сеансов</dt><dd>{user._count.sessions}</dd></div>
              <div className="flex justify-between"><dt>Попыток тестов</dt><dd>{user._count.testAttempts}</dd></div>
              <div className="flex justify-between"><dt>Обращений в поддержку</dt><dd>{user._count.conversations}</dd></div>
            </dl>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="font-semibold text-slate-900">Пароль</h2>
            <ActionForm action={sendResetLink.bind(null, user.id)}>
              <SubmitButton className="btn-secondary w-full">Отправить ссылку для восстановления</SubmitButton>
            </ActionForm>
            <ActionForm action={setPassword.bind(null, user.id)} resetOnSuccess className="flex gap-2">
              <input name="password" placeholder="Новый пароль" className="input" required />
              <SubmitButton className="btn-secondary shrink-0">Задать</SubmitButton>
            </ActionForm>
          </section>

          {!isSelf && (
            <section className="card space-y-3 p-6">
              <h2 className="font-semibold text-slate-900">Управление аккаунтом</h2>
              <form action={setBlocked.bind(null, user.id, !user.blocked)}>
                {user.blocked ? (
                  <SubmitButton className="btn-secondary w-full">Разблокировать</SubmitButton>
                ) : (
                  <ConfirmButton className="btn-secondary w-full text-amber-700" message="Заблокировать пользователя? Все его сеансы будут завершены.">Заблокировать</ConfirmButton>
                )}
              </form>
              <form action={deleteUser.bind(null, user.id)}>
                <ConfirmButton className="btn-danger w-full" message={`Удалить пользователя ${user.name} безвозвратно вместе со всем прогрессом?`}>
                  Удалить пользователя
                </ConfirmButton>
              </form>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
