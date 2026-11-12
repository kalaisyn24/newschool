import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, CourseCover, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { formatDuration, lessonsLabel } from "@/lib/format";
import { enroll, requestAccess } from "../actions";

export const metadata: Metadata = { title: "Каталог курсов" };

export default async function CatalogPage() {
  const user = await requireLearner();
  const [courses, enrollments] = await Promise.all([
    db.course.findMany({
      where: { published: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      include: { modules: { select: { lessons: { where: { published: true }, select: { durationSec: true } } } } },
    }),
    db.enrollment.findMany({ where: { userId: user.id }, select: { courseId: true, status: true } }),
  ]);
  const enrolled = new Map(enrollments.map((e) => [e.courseId, e.status]));

  return (
    <>
      <PageHeader title="Каталог курсов" subtitle="Все опубликованные курсы школы" />
      {courses.length === 0 && <EmptyState title="Курсы скоро появятся" />}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {courses.map((c) => {
          const lessons = c.modules.flatMap((m) => m.lessons);
          const duration = lessons.reduce((s, l) => s + l.durationSec, 0);
          const status = enrolled.get(c.id);
          return (
            <div key={c.id} className="card flex flex-col overflow-hidden">
              <CourseCover url={c.coverUrl} title={c.title} className="aspect-[16/9]" />
              <div className="flex flex-1 flex-col p-5">
                <div className="mb-2 flex gap-2">
                  {c.access === "OPEN" ? <Badge tone="green">Свободная запись</Badge> : <Badge tone="amber">По доступу</Badge>}
                  {c.certificateEnabled && <Badge tone="brand">Сертификат</Badge>}
                </div>
                <h3 className="font-semibold text-slate-900">{c.title}</h3>
                {c.teacherName && <p className="mt-1 text-xs text-slate-500">Преподаватель: {c.teacherName}</p>}
                <p className="mt-2 line-clamp-3 text-sm text-slate-600">{c.shortDescription}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {lessonsLabel(lessons.length)} · {formatDuration(duration)}
                </p>
                <div className="mt-auto pt-4">
                  {status === "ACTIVE" ? (
                    <Link href={`/learn/courses/${c.id}`} className="btn-secondary w-full">
                      Перейти к курсу
                    </Link>
                  ) : c.access === "OPEN" && status !== "REVOKED" ? (
                    <form action={enroll.bind(null, c.id)}>
                      <SubmitButton className="btn-primary w-full">Записаться бесплатно</SubmitButton>
                    </form>
                  ) : (
                    <form action={requestAccess.bind(null, c.id)}>
                      <SubmitButton className="btn-secondary w-full">Запросить доступ</SubmitButton>
                    </form>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
