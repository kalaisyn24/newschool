import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCourseState } from "@/lib/learning";
import { Badge, PageHeader, ProgressBar, Table } from "@/components/ui";
import { ConfirmButton, SubmitButton } from "@/components/forms";
import { LessonStatusBadge } from "@/components/lesson-status";
import { formatDateTime } from "@/lib/format";
import { markLessonComplete, resetLessonProgress, resetTestAttempts } from "../../../actions";

export default async function UserCourseProgressPage({ params }: PageProps<"/admin/users/[id]/courses/[courseId]">) {
  await requireRole("ADMIN");
  const { id, courseId } = await params;
  const [user, state] = await Promise.all([
    db.user.findUnique({ where: { id }, select: { id: true, name: true } }),
    getCourseState(id, courseId),
  ]);
  if (!user || !state) notFound();
  const lessonIds = state.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const attempts = await db.testAttempt.findMany({
    where: { userId: id, test: { lessonId: { in: lessonIds } } },
    orderBy: { createdAt: "desc" },
    include: { test: { select: { lessonId: true, maxAttempts: true } } },
  });
  const byLesson = new Map<string, typeof attempts>();
  for (const a of attempts) byLesson.set(a.test.lessonId, [...(byLesson.get(a.test.lessonId) ?? []), a]);

  return (
    <>
      <PageHeader
        back={{ href: `/admin/users/${id}`, label: user.name }}
        title={state.course.title}
        subtitle={`Прогресс студента: ${state.completedCount} из ${state.total} уроков`}
      />
      <div className="card mb-6 flex items-center gap-4 p-5">
        <ProgressBar value={state.percent} />
        <span className="text-lg font-semibold text-slate-900">{state.percent}%</span>
      </div>
      {state.modules.map((m) => (
        <section key={m.id} className="mb-6">
          <h2 className="mb-2 font-semibold text-slate-900">{m.title}</h2>
          <Table>
            <thead>
              <tr>
                <th>Урок</th>
                <th>Статус</th>
                <th>Видео</th>
                <th>Тест</th>
                <th>Последний просмотр</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {m.lessons.map((l) => {
                const p = l.progress;
                const at = byLesson.get(l.id) ?? [];
                const best = at.reduce((s, a) => Math.max(s, a.score), 0);
                return (
                  <tr key={l.id}>
                    <td className="font-medium text-slate-800">{l.title}</td>
                    <td><LessonStatusBadge status={l.status} /></td>
                    <td className="text-slate-600">{l.videoUrl ? `${p?.videoPercent ?? 0}%` : "—"}</td>
                    <td className="text-slate-600">
                      {l.test && l.test._count.questions > 0 ? (
                        at.length ? (
                          <span>
                            {best}% · {at.length}
                            {at[0].test.maxAttempts ? `/${at[0].test.maxAttempts}` : ""} поп.{" "}
                            {p?.testPassed && <Badge tone="green">сдан</Badge>}
                          </span>
                        ) : (
                          "не начат"
                        )
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-slate-500">{formatDateTime(p?.lastViewedAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1">
                        {!p?.completedAt && (
                          <form action={markLessonComplete.bind(null, id, l.id)}>
                            <SubmitButton className="btn-ghost btn-sm">Засчитать</SubmitButton>
                          </form>
                        )}
                        {at.length > 0 && (
                          <form action={resetTestAttempts.bind(null, id, l.id)}>
                            <ConfirmButton className="btn-ghost btn-sm" message="Сбросить попытки теста? Студент сможет пройти тест заново.">Сбросить попытки</ConfirmButton>
                          </form>
                        )}
                        {p && (
                          <form action={resetLessonProgress.bind(null, id, l.id)}>
                            <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Сбросить весь прогресс по уроку?">Сбросить</ConfirmButton>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </section>
      ))}
    </>
  );
}
