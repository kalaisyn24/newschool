import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLastLesson, getMyCourses } from "@/lib/student";
import { CourseCard } from "@/components/course-card";
import { CourseCover, EmptyState, ProgressBar, SectionTitle, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDateTime, plural } from "@/lib/format";

export const metadata: Metadata = { title: "Личный кабинет" };

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
}

export default async function LearnHome() {
  const user = await requireLearner();
  const [courses, last, notifications] = await Promise.all([
    getMyCourses(user.id),
    getLastLesson(user.id),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const active = courses.filter((c) => c.status !== "blocked");
  const completedLessons = active.reduce((s, c) => s + c.completed, 0);
  const totalLessons = active.reduce((s, c) => s + c.lessons, 0);
  const overall = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;
  const inProgress = active.filter((c) => c.status !== "completed");
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#0b1633_0%,#15306f_45%,#2456e0_100%)] p-5 text-white shadow-lift sm:p-8">
        <div className="absolute -top-16 -right-10 size-56 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="absolute right-32 -bottom-20 size-48 rounded-full bg-brand-400/40 blur-3xl" />
        <p className="relative text-sm text-white/80">{greeting()},</p>
        <h1 className="relative mt-1 text-2xl font-semibold sm:text-3xl">{firstName}! Рады видеть вас снова 👋</h1>
        <p className="relative mt-2 max-w-xl text-sm text-white/80">
          {inProgress.length
            ? `У вас ${inProgress.length} ${plural(inProgress.length, "активный курс", "активных курса", "активных курсов")}. Продолжайте в том же духе!`
            : "Выберите курс в каталоге и начните обучение."}
        </p>
        {last && (
          <Link href={`/learn/lessons/${last.lesson.id}`} className="btn relative mt-5 w-full bg-white text-ink shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] hover:bg-amber-50 sm:w-auto">
            <Icon name="play" className="size-4" /> Продолжить обучение
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Доступно курсов" value={active.length} icon={<Icon name="book" />} />
        <StatCard label="Пройдено уроков" value={completedLessons} hint={`из ${totalLessons}`} icon={<Icon name="check" />} />
        <StatCard
          label="Общий прогресс"
          value={`${overall}%`}
          hint={<ProgressBar value={overall} size="sm" className="mt-2" />}
          icon={<Icon name="chart" />}
        />
        <StatCard
          label="Завершено курсов"
          value={courses.filter((c) => c.status === "completed").length}
          icon={<Icon name="award" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <SectionTitle>Продолжить обучение</SectionTitle>
          {last ? (
            <Link href={`/learn/lessons/${last.lesson.id}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift">
              <CourseCover url={last.lesson.module.course.coverUrl} title={last.lesson.module.course.title} className="aspect-video !w-36 shrink-0 rounded-xl sm:!w-44" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-slate-500">
                  {last.lesson.module.course.title} · {last.lesson.module.title}
                </p>
                <p className="mt-1 line-clamp-2 font-semibold text-slate-900">{last.lesson.title}</p>
                <p className="mt-1 text-xs text-slate-500">Последний просмотр: {formatDateTime(last.lastViewedAt)}</p>
                {last.videoDuration > 0 && <ProgressBar value={last.videoPercent} size="sm" className="mt-2 max-w-xs" />}
              </div>
              <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-600 text-ink shadow-glow sm:grid">
                <Icon name="play" className="size-4" />
              </span>
            </Link>
          ) : (
            <EmptyState title="Вы ещё не начали ни одного урока" text="Откройте курс и начните первый урок — прогресс сохранится автоматически." />
          )}
        </section>

        <section>
          <SectionTitle action={<Link href="/learn/notifications" className="text-sm link">Все</Link>}>Уведомления</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {notifications.length === 0 && <p className="p-4 text-sm text-slate-500">Новых уведомлений нет</p>}
            {notifications.map((n) => (
              <div key={n.id} className="flex gap-3 p-4">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-slate-200" : "bg-brand-500"}`} />
                <div className="min-w-0">
                  {n.link ? (
                    <Link href={n.link} className="text-sm font-medium text-slate-900 hover:text-brand-700">{n.title}</Link>
                  ) : (
                    <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  )}
                  <p className="text-xs text-slate-500">{formatDateTime(n.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/learn/support" className="card mt-4 flex items-center gap-3 p-4 transition hover:border-brand-200">
            <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 text-sky-700">
              <Icon name="chat" />
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-900">Нужна помощь?</span>
              <span className="block text-xs text-slate-500">Напишите в техподдержку</span>
            </span>
          </Link>
        </section>
      </div>

      <section>
        <SectionTitle action={<Link href="/learn/courses" className="text-sm link">Все курсы</Link>}>Активные курсы</SectionTitle>
        {inProgress.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {inProgress.slice(0, 6).map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Нет активных курсов"
            text="Посмотрите каталог — возможно, там есть то, что вам интересно."
            action={<Link href="/learn/catalog" className="btn-primary">Открыть каталог</Link>}
          />
        )}
      </section>
    </div>
  );
}
