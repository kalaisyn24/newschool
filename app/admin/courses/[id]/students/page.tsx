import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseState, enrollmentIsActive } from "@/lib/learning";
import { Avatar, Badge, EmptyState, PageHeader, ProgressBar, Table } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, SubmitButton } from "@/components/forms";
import { formatDate, formatDateTime } from "@/lib/format";
import { revokeAccess, restoreAccess } from "../../../users/actions";
import { grantByEmail } from "../../actions";

export default async function CourseStudentsPage({ params }: PageProps<"/admin/courses/[id]/students">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: { enrollments: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!course) notFound();
  const states = await Promise.all(course.enrollments.map((e) => getCourseState(e.userId, id)));
  const active = course.enrollments.filter((e) => enrollmentIsActive(e)).length;
  const done = course.enrollments.filter((e) => e.completedAt).length;
  const avg = states.length ? Math.round(states.reduce((s, x) => s + (x?.percent ?? 0), 0) / states.length) : 0;

  return (
    <>
      <PageHeader
        back={{ href: `/admin/courses/${id}`, label: course.title }}
        title="Студенты курса"
        subtitle={`С доступом: ${active} · завершили: ${done} · средний прогресс: ${avg}%`}
      />
      <div className="card mb-6 p-5">
        <ActionForm action={grantByEmail.bind(null, id)} resetOnSuccess className="flex flex-wrap items-end gap-2">
          <Field label="Открыть доступ по e-mail" hint="Можно несколько адресов через запятую или пробел" className="min-w-72 flex-1">
            <input name="emails" className="input" placeholder="student@example.com, other@example.com" />
          </Field>
          <SubmitButton>Открыть доступ</SubmitButton>
        </ActionForm>
      </div>
      {course.enrollments.length === 0 ? (
        <EmptyState title="На курсе пока нет студентов" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Студент</th>
              <th>Прогресс</th>
              <th>Доступ</th>
              <th>Последняя активность</th>
              <th>Завершён</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {course.enrollments.map((e, i) => {
              const st = states[i];
              const isActive = enrollmentIsActive(e);
              return (
                <tr key={e.id}>
                  <td>
                    <Link href={`/admin/users/${e.user.id}/courses/${id}`} className="flex items-center gap-3">
                      <Avatar name={e.user.name} size={30} />
                      <span>
                        <span className="block font-medium text-slate-900 hover:text-brand-700">{e.user.name}</span>
                        <span className="block text-xs text-slate-500">{e.user.email}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="w-48">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={st?.percent ?? 0} size="sm" />
                      <span className="text-xs text-slate-500">{st?.percent ?? 0}%</span>
                    </div>
                  </td>
                  <td>
                    {isActive ? <Badge tone="green">Открыт{e.expiresAt ? ` до ${formatDate(e.expiresAt)}` : ""}</Badge> : <Badge tone="red">Закрыт</Badge>}
                  </td>
                  <td className="text-slate-500">{formatDateTime(e.lastAccessAt)}</td>
                  <td className="text-slate-500">{e.completedAt ? formatDate(e.completedAt) : "—"}</td>
                  <td className="text-right">
                    {isActive ? (
                      <form action={revokeAccess.bind(null, e.user.id, id)}>
                        <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Закрыть доступ к курсу?">Закрыть</ConfirmButton>
                      </form>
                    ) : (
                      <form action={restoreAccess.bind(null, e.user.id, id)}>
                        <SubmitButton className="btn-ghost btn-sm text-emerald-700">Открыть</SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
