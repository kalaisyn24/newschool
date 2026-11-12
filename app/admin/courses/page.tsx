import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, CourseCover, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { lessonsLabel, modulesLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Курсы" };

export default async function AdminCoursesPage() {
  await requireRole("ADMIN");
  const courses = await db.course.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    include: {
      modules: { select: { _count: { select: { lessons: true } } } },
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  const completions = await db.enrollment.groupBy({
    by: ["courseId"],
    where: { completedAt: { not: null } },
    _count: { _all: true },
  });
  const doneBy = new Map(completions.map((c) => [c.courseId, c._count._all]));

  return (
    <>
      <PageHeader
        title="Курсы"
        subtitle={`Всего: ${courses.length}`}
        actions={<Link href="/admin/courses/new" className="btn-primary"><Icon name="plus" className="size-4" /> Создать курс</Link>}
      />
      {courses.length === 0 ? (
        <EmptyState title="Курсов пока нет" text="Создайте первый курс — добавьте модули, уроки, видео и тесты." action={<Link href="/admin/courses/new" className="btn-primary">Создать курс</Link>} />
      ) : (
        <div className="card divide-y divide-slate-100">
          {courses.map((c) => {
            const lessons = c.modules.reduce((s, m) => s + m._count.lessons, 0);
            return (
              <div key={c.id} className="flex flex-wrap items-center gap-4 p-4">
                <CourseCover url={c.coverUrl} title={c.title} className="aspect-video !w-32 shrink-0 rounded-xl text-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/courses/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{c.title}</Link>
                    {c.published ? <Badge tone="green">Опубликован</Badge> : <Badge tone="amber">Черновик</Badge>}
                    {c.access === "OPEN" ? <Badge tone="blue">Свободная запись</Badge> : <Badge>По доступу</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {modulesLabel(c.modules.length)} · {lessonsLabel(lessons)} · студентов: {c._count.enrollments} · завершили: {doneBy.get(c.id) ?? 0}
                    {c.teacherName && ` · ${c.teacherName}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/admin/courses/${c.id}/students`} className="btn-secondary btn-sm">Студенты</Link>
                  <Link href={`/admin/courses/${c.id}`} className="btn-primary btn-sm">Редактировать</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
