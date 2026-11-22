import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { courseStatusFor, getCourseState, getEnrollment, enrollmentIsActive } from "@/lib/learning";
import { Alert, Badge, CourseCover, ProgressBar } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { Markdown } from "@/components/markdown";
import { LessonStatusIcon, LessonStatusBadge } from "@/components/lesson-status";
import { courseStatusMeta } from "@/components/course-card";
import { Icon } from "@/components/icons";
import { formatDate, formatDuration, lessonsLabel, modulesLabel } from "@/lib/format";
import { enroll, requestAccess } from "../../actions";

export default async function CoursePage({ params }: PageProps<"/learn/courses/[courseId]">) {
  const user = await requireLearner();
  const { courseId } = await params;
  const state = await getCourseState(user.id, courseId);
  const isStaff = user.role === "ADMIN";
  if (!state || (!state.course.published && !isStaff)) notFound();
  const enrollment = await getEnrollment(user.id, courseId);
  const hasAccess = enrollmentIsActive(enrollment) && state.course.published;
  const canOpen = hasAccess || isStaff;
  const status = courseStatusFor(enrollment, state.course.published, state.completedCount);
  const certificate = enrollment?.completedAt
    ? await db.certificate.findUnique({ where: { userId_courseId: { userId: user.id, courseId } } })
    : null;
  const { course } = state;
  const objectives = course.objectives.split("\n").map((s) => s.trim()).filter(Boolean);
  const continueId = enrollment?.lastLessonId && !enrollment.completedAt ? state.nextLessonId ?? enrollment.lastLessonId : state.nextLessonId;
  const firstLesson = state.modules.flatMap((m) => m.lessons)[0];
  let n = 0;

  return (
    <div className="space-y-6">
      <Link href="/learn/courses" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
        ← Мои курсы
      </Link>

      <div className="card overflow-hidden lg:grid lg:grid-cols-[1.1fr_1fr]">
        <CourseCover url={course.coverUrl} title={course.title} className="aspect-[16/9] h-full lg:aspect-auto" />
        <div className="flex flex-col p-6 sm:p-8">
          <div className="flex flex-wrap gap-2">
            {enrollment && <Badge tone={courseStatusMeta[status].tone}>{courseStatusMeta[status].label}</Badge>}
            {!course.published && <Badge tone="amber">Черновик (предпросмотр)</Badge>}
            {course.certificateEnabled && <Badge tone="brand">С сертификатом</Badge>}
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{course.title}</h1>
          <p className="mt-2 text-slate-600">{course.shortDescription}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Icon name="grid" className="size-4" /> {modulesLabel(state.modules.length)}</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="book" className="size-4" /> {lessonsLabel(state.total)}</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="clock" className="size-4" /> {formatDuration(state.totalDuration)}</span>
          </div>
          {course.teacherName && (
            <p className="mt-3 text-sm text-slate-600">
              Преподаватель: <b className="font-medium text-slate-900">{course.teacherName}</b>
            </p>
          )}
          <div className="mt-auto pt-6">
            {hasAccess && (
              <>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-slate-500">Пройдено {state.completedCount} из {state.total}</span>
                  <span className="font-semibold text-slate-900">{state.percent}%</span>
                </div>
                <ProgressBar value={state.percent} />
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2">
              {canOpen && (continueId || firstLesson) && (
                <Link href={`/learn/lessons/${continueId ?? firstLesson!.id}`} className="btn-primary">
                  <Icon name="play" className="size-4" />
                  {state.completedCount === 0 ? "Начать обучение" : enrollment?.completedAt ? "Повторить курс" : "Продолжить"}
                </Link>
              )}
              {certificate && (
                <Link href={`/learn/certificates/${certificate.id}`} className="btn-secondary">
                  <Icon name="award" className="size-4" /> {certificate.issuedAt ? "Сертификат" : "Сертификат готовится"}
                </Link>
              )}
              {!enrollment && !isStaff && course.access === "OPEN" && (
                <form action={enroll.bind(null, course.id)}>
                  <SubmitButton>Записаться на курс</SubmitButton>
                </form>
              )}
              {!hasAccess && !isStaff && (enrollment || course.access === "BY_GRANT") && (
                <form action={requestAccess.bind(null, course.id)}>
                  <SubmitButton className="btn-secondary">Запросить доступ</SubmitButton>
                </form>
              )}
            </div>
            {enrollment?.completedAt && (
              <p className="mt-3 text-sm text-emerald-700">Курс завершён {formatDate(enrollment.completedAt)} 🎉</p>
            )}
          </div>
        </div>
      </div>

      {enrollment && !hasAccess && (
        <Alert tone="red">
          Доступ к курсу закрыт{enrollment.expiresAt && enrollment.expiresAt < new Date() ? " (срок доступа истёк)" : ""}. Ваш прогресс сохранён — обратитесь в поддержку, чтобы восстановить доступ.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Программа курса</h2>
          {state.modules.map((m, mi) => {
            const done = m.lessons.filter((l) => l.status === "completed").length;
            return (
              <div key={m.id} className="card overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Модуль {mi + 1}</p>
                    <p className="font-semibold text-slate-900">{m.title}</p>
                  </div>
                  <span className="text-xs text-slate-500">{done}/{m.lessons.length}</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {m.lessons.map((l) => {
                    n++;
                    const st = canOpen ? (isStaff && l.status === "locked" ? "available" : l.status) : "locked";
                    const clickable = st !== "locked";
                    const inner = (
                      <>
                        <LessonStatusIcon status={st} index={n} />
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium ${clickable ? "text-slate-900" : "text-slate-400"}`}>{l.title}</p>
                          {l.summary && <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">{l.summary}</p>}
                          <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                            {l.videoUrl && <span>Видео · {formatDuration(l.durationSec)}</span>}
                            {l.test && l.test._count.questions > 0 && <span>Тест</span>}
                            {l.assignment && <span>Задание</span>}
                            {l._count.materials > 0 && <span>Материалы: {l._count.materials}</span>}
                            {l.progress && l.progress.videoPercent > 0 && !l.progress.completedAt && <span>Просмотрено {l.progress.videoPercent}%</span>}
                          </p>
                        </div>
                        <span className="hidden sm:block"><LessonStatusBadge status={st} /></span>
                      </>
                    );
                    return (
                      <li key={l.id}>
                        {clickable ? (
                          <Link href={`/learn/lessons/${l.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-slate-50">
                            {inner}
                          </Link>
                        ) : (
                          <div className="flex cursor-not-allowed items-center gap-4 px-5 py-3.5">{inner}</div>
                        )}
                      </li>
                    );
                  })}
                  {m.lessons.length === 0 && <li className="px-5 py-4 text-sm text-slate-400">Уроки скоро появятся</li>}
                </ul>
              </div>
            );
          })}
          {course.sequential && (
            <p className="text-xs text-slate-500">
              Уроки открываются последовательно: следующий урок станет доступен после выполнения условий предыдущего.
            </p>
          )}
        </section>

        <aside className="space-y-6">
          {objectives.length > 0 && (
            <div className="card p-5">
              <h3 className="mb-3 font-semibold text-slate-900">Чему вы научитесь</h3>
              <ul className="space-y-2.5">
                {objectives.map((o, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-slate-700">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-brand-700" />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="card p-5">
            <h3 className="mb-2 font-semibold text-slate-900">О курсе</h3>
            <Markdown text={course.description} className="prose-lesson text-sm" />
          </div>
          {course.teacherBio && (
            <div className="card p-5">
              <h3 className="mb-2 font-semibold text-slate-900">Преподаватель</h3>
              <p className="text-sm font-medium text-slate-800">{course.teacherName}</p>
              <p className="mt-1 text-sm whitespace-pre-line text-slate-600">{course.teacherBio}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
