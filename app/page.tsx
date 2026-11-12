import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Logo } from "@/components/logo";
import { CourseCover, Skeleton } from "@/components/ui";
import { Icon, type IconName } from "@/components/icons";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDuration, lessonsLabel } from "@/lib/format";

const features: { icon: IconName; title: string; text: string }[] = [
  { icon: "play", title: "Видеоуроки", text: "Смотрите уроки прямо в личном кабинете — плеер запомнит, где вы остановились." },
  { icon: "clipboard", title: "Тесты и задания", text: "Проверяйте знания после каждого урока и получайте результат сразу." },
  { icon: "chart", title: "Прогресс", text: "Наглядная статистика: пройденные уроки, результаты тестов, история обучения." },
  { icon: "award", title: "Сертификаты", text: "По окончании курса — именной сертификат, который можно распечатать." },
  { icon: "chat", title: "Поддержка", text: "Внутренний чат с технической поддержкой — ответим на любой вопрос." },
  { icon: "lock", title: "Безопасность", text: "Личный кабинет защищён, сессии и прогресс сохраняются автоматически." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo />
          <Suspense fallback={<Skeleton className="h-10 w-40" />}>
            <HeaderActions />
          </Suspense>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-50 via-white to-white" />
        <div className="absolute -top-32 -right-32 size-[480px] rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm ring-1 ring-brand-100">
            Дистанционное обучение
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Учитесь онлайн по видеокурсам — <span className="text-brand-600">в удобном темпе</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-600">
            Видеоуроки, материалы, тесты и практические задания в одном личном кабинете. Прогресс сохраняется автоматически.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">Начать обучение</Link>
            <a href="#courses" className="btn-secondary px-6 py-3 text-base">Смотреть курсы</a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-100">
                <Icon name={f.icon} />
              </span>
              <p className="mt-4 font-semibold text-slate-900">{f.title}</p>
              <p className="mt-1 text-sm text-slate-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="courses" className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Курсы школы</h2>
        <p className="mt-1 text-slate-500">Зарегистрируйтесь, чтобы начать обучение</p>
        <Suspense
          fallback={
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
            </div>
          }
        >
          <PublicCourses />
        </Suspense>
      </section>

      <footer className="mt-auto border-t border-slate-100 py-8 text-center text-sm text-slate-400">
        © Онлайн-школа · <Link href="/login" className="hover:text-slate-600">Вход</Link> · <Link href="/register" className="hover:text-slate-600">Регистрация</Link>
      </footer>
    </div>
  );
}

async function HeaderActions() {
  const user = await getCurrentUser();
  if (user) {
    return <Link href={homeFor(user.role)} className="btn-primary">Личный кабинет</Link>;
  }
  return (
    <div className="flex gap-2">
      <Link href="/login" className="btn-ghost">Войти</Link>
      <Link href="/register" className="btn-primary">Регистрация</Link>
    </div>
  );
}

async function PublicCourses() {
  await connection();
  let courses;
  try {
    courses = await db.course.findMany({
      where: { published: true },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take: 9,
      include: { modules: { select: { lessons: { where: { published: true }, select: { durationSec: true } } } } },
    });
  } catch {
    return <p className="mt-6 text-sm text-slate-500">Каталог временно недоступен.</p>;
  }
  if (!courses.length) return <p className="mt-6 text-sm text-slate-500">Курсы скоро появятся.</p>;
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => {
        const lessons = c.modules.flatMap((m) => m.lessons);
        return (
          <Link key={c.id} href={`/learn/courses/${c.id}`} className="card group overflow-hidden transition hover:shadow-lg">
            <CourseCover url={c.coverUrl} title={c.title} className="aspect-[16/9]" />
            <div className="p-5">
              <p className="font-semibold text-slate-900 group-hover:text-brand-700">{c.title}</p>
              {c.teacherName && <p className="mt-1 text-xs text-slate-500">{c.teacherName}</p>}
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">{c.shortDescription}</p>
              <p className="mt-3 text-xs text-slate-500">
                {lessonsLabel(lessons.length)} · {formatDuration(lessons.reduce((s, l) => s + l.durationSec, 0))}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
