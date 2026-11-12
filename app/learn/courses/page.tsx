import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { getMyCourses } from "@/lib/student";
import { CourseCard } from "@/components/course-card";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Мои курсы" };

const filters = [
  { key: "all", label: "Все" },
  { key: "in_progress", label: "В процессе" },
  { key: "available", label: "Не начатые" },
  { key: "completed", label: "Завершённые" },
  { key: "blocked", label: "Заблокированные" },
] as const;

export default async function MyCoursesPage({ searchParams }: PageProps<"/learn/courses">) {
  const user = await requireLearner();
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "all";
  const courses = await getMyCourses(user.id);
  const shown = filter === "all" ? courses : courses.filter((c) => c.status === filter);

  return (
    <>
      <PageHeader title="Мои курсы" subtitle={`Доступно курсов: ${courses.filter((c) => c.status !== "blocked").length}`} />
      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => {
          const count = f.key === "all" ? courses.length : courses.filter((c) => c.status === f.key).length;
          if (f.key === "blocked" && !count) return null;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/learn/courses" : `/learn/courses?status=${f.key}`}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label} <span className="opacity-60">{count}</span>
            </Link>
          );
        })}
      </div>
      {shown.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={courses.length ? "В этой категории курсов нет" : "У вас пока нет курсов"}
          text="Курсы появятся здесь после записи из каталога или когда администратор откроет вам доступ."
          action={<Link href="/learn/catalog" className="btn-primary">Перейти в каталог</Link>}
        />
      )}
    </>
  );
}
