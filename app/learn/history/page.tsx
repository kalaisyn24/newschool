import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, EmptyState, PageHeader, ProgressBar, Table } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { activityLabel } from "@/lib/activity-labels";

export const metadata: Metadata = { title: "История обучения" };

export default async function HistoryPage() {
  const user = await requireLearner();
  const [progress, events] = await Promise.all([
    db.lessonProgress.findMany({
      where: { userId: user.id },
      orderBy: { lastViewedAt: "desc" },
      take: 100,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            module: { select: { course: { select: { title: true } } } },
            test: { select: { attempts: { where: { userId: user.id }, select: { score: true, passed: true } } } },
          },
        },
      },
    }),
    db.activityLog.findMany({
      where: { userId: user.id, action: { notIn: ["login"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <>
      <PageHeader title="История обучения" subtitle="Просмотренные уроки, результаты тестов и ключевые события" />
      {progress.length === 0 ? (
        <EmptyState title="История пока пуста" text="Здесь появятся уроки, которые вы начали проходить." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Урок</th>
              <th>Видео</th>
              <th>Тест</th>
              <th>Статус</th>
              <th>Последний визит</th>
            </tr>
          </thead>
          <tbody>
            {progress.map((p) => {
              const attempts = p.lesson.test?.attempts ?? [];
              const best = attempts.reduce((m, a) => Math.max(m, a.score), 0);
              return (
                <tr key={p.id}>
                  <td>
                    <Link href={`/learn/lessons/${p.lesson.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {p.lesson.title}
                    </Link>
                    <p className="text-xs text-slate-500">{p.lesson.module.course.title}</p>
                  </td>
                  <td className="w-40">
                    {p.videoDuration > 0 ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar value={p.videoPercent} size="sm" />
                        <span className="text-xs text-slate-500">{p.videoPercent}%</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="text-sm">
                    {attempts.length ? (
                      <span className={p.testPassed ? "text-emerald-600" : "text-slate-600"}>
                        {best}% · попыток {attempts.length}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td>{p.completedAt ? <Badge tone="green">Пройден</Badge> : <Badge tone="brand">В процессе</Badge>}</td>
                  <td className="text-sm text-slate-500">{formatDateTime(p.lastViewedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Хронология</h2>
          <ol className="card relative space-y-0 p-5">
            {events.map((e) => (
              <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
                <span className="relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {activityLabel(e.action)}
                    {e.details && <span className="font-normal text-slate-600"> — {e.link ? <Link className="link" href={e.link}>{e.details}</Link> : e.details}</span>}
                  </p>
                  <p className="text-xs text-slate-500">{formatDateTime(e.createdAt)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
