import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/forms";
import { CourseForm } from "@/components/admin/course-form";
import { formatDuration } from "@/lib/format";
import {
  addLesson,
  addModule,
  deleteCourse,
  deleteLesson,
  deleteModule,
  moveLesson,
  moveModule,
  renameModule,
  updateCourse,
} from "../actions";

export default async function EditCoursePage({ params }: PageProps<"/admin/courses/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const course = await db.course.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: { test: { select: { _count: { select: { questions: true } } } }, _count: { select: { materials: true } } },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) notFound();

  return (
    <>
      <PageHeader
        back={{ href: "/admin/courses", label: "Курсы" }}
        title={course.title}
        subtitle={course.published ? <Badge tone="green">Опубликован</Badge> : <Badge tone="amber">Черновик — не виден студентам</Badge>}
        actions={
          <>
            <Link href={`/learn/courses/${course.id}`} className="btn-secondary" target="_blank">Предпросмотр</Link>
            <Link href={`/admin/courses/${course.id}/students`} className="btn-secondary">Студенты ({course._count.enrollments})</Link>
          </>
        }
      />

      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Программа курса</h2>
          <div className="space-y-4">
            {course.modules.map((m, mi) => (
              <div key={m.id} className="rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase">Модуль {mi + 1}</span>
                  <ActionForm action={renameModule.bind(null, m.id)} className="flex min-w-60 flex-1 items-center gap-2">
                    <input name="title" defaultValue={m.title} className="input py-1.5 font-medium" />
                    <SubmitButton className="btn-secondary btn-sm">Сохранить</SubmitButton>
                  </ActionForm>
                  <div className="flex gap-1">
                    <form action={moveModule.bind(null, m.id, -1)}><button className="btn-ghost btn-sm" disabled={mi === 0} title="Выше">↑</button></form>
                    <form action={moveModule.bind(null, m.id, 1)}><button className="btn-ghost btn-sm" disabled={mi === course.modules.length - 1} title="Ниже">↓</button></form>
                    <form action={deleteModule.bind(null, m.id)}>
                      <ConfirmButton className="btn-ghost btn-sm text-rose-600" message={`Удалить модуль «${m.title}» вместе со всеми уроками?`}>Удалить</ConfirmButton>
                    </form>
                  </div>
                </div>
                <ul className="divide-y divide-slate-100">
                  {m.lessons.map((l, li) => (
                    <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <span className="w-6 text-center text-xs text-slate-400">{li + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/admin/lessons/${l.id}`} className="font-medium text-slate-900 hover:text-brand-700">{l.title}</Link>
                        <div className="mt-0.5 flex flex-wrap gap-1.5">
                          {!l.published && <Badge tone="amber">скрыт</Badge>}
                          {l.videoUrl ? <Badge tone="blue">видео {formatDuration(l.durationSec)}</Badge> : <Badge>без видео</Badge>}
                          {l.test && l.test._count.questions > 0 && <Badge tone="brand">тест · {l.test._count.questions} вопр.</Badge>}
                          {l.assignment && <Badge>задание</Badge>}
                          {l._count.materials > 0 && <Badge>материалы · {l._count.materials}</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <form action={moveLesson.bind(null, l.id, -1)}><button className="btn-ghost btn-sm" disabled={li === 0}>↑</button></form>
                        <form action={moveLesson.bind(null, l.id, 1)}><button className="btn-ghost btn-sm" disabled={li === m.lessons.length - 1}>↓</button></form>
                        <Link href={`/admin/lessons/${l.id}`} className="btn-secondary btn-sm">Изменить</Link>
                        <form action={deleteLesson.bind(null, l.id, undefined)}>
                          <ConfirmButton className="btn-ghost btn-sm text-rose-600" message={`Удалить урок «${l.title}»? Прогресс студентов по нему будет удалён.`}>✕</ConfirmButton>
                        </form>
                      </div>
                    </li>
                  ))}
                  <li className="px-4 py-3">
                    <ActionForm action={addLesson.bind(null, m.id)} className="flex flex-wrap gap-2">
                      <input name="title" placeholder="Название нового урока" className="input max-w-md flex-1 py-2" required />
                      <SubmitButton className="btn-secondary">+ Урок</SubmitButton>
                    </ActionForm>
                  </li>
                </ul>
              </div>
            ))}
          </div>
          <ActionForm action={addModule.bind(null, course.id)} resetOnSuccess className="mt-4 flex flex-wrap gap-2">
            <input name="title" placeholder="Название нового модуля" className="input max-w-md flex-1" required />
            <SubmitButton>+ Добавить модуль</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Настройки курса</h2>
          <CourseForm action={updateCourse.bind(null, course.id)} course={course} submitLabel="Сохранить изменения" />
        </section>

        <section className="card border-rose-200 p-6">
          <h2 className="font-semibold text-rose-700">Удаление курса</h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">Будут удалены все модули, уроки, тесты, материалы и прогресс студентов. Действие необратимо.</p>
          <form action={deleteCourse.bind(null, course.id)}>
            <ConfirmButton message={`Удалить курс «${course.title}» безвозвратно?`}>Удалить курс</ConfirmButton>
          </form>
        </section>
      </div>
    </>
  );
}
