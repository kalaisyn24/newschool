import Link from "next/link";
import type { MyCourse } from "@/lib/student";
import type { CourseStatus } from "@/lib/learning";
import { Badge, CourseCover, ProgressBar, type Tone } from "@/components/ui";
import { formatDuration, lessonsLabel } from "@/lib/format";
import { Icon } from "@/components/icons";

export const courseStatusMeta: Record<CourseStatus, { label: string; tone: Tone }> = {
  available: { label: "Доступен", tone: "blue" },
  in_progress: { label: "В процессе", tone: "brand" },
  completed: { label: "Завершён", tone: "green" },
  blocked: { label: "Заблокирован", tone: "red" },
};

export function CourseCard({ course }: { course: MyCourse }) {
  const meta = courseStatusMeta[course.status];
  const blocked = course.status === "blocked";
  const cta =
    course.status === "available" ? "Начать обучение" : course.status === "completed" ? "Повторить" : "Продолжить";
  const target = course.status === "in_progress" && course.nextLessonId ? `/learn/lessons/${course.nextLessonId}` : `/learn/courses/${course.id}`;
  return (
    <div className={`card group flex flex-col overflow-hidden ${blocked ? "opacity-70" : ""}`}>
      <Link href={`/learn/courses/${course.id}`} className="relative block">
        <CourseCover url={course.coverUrl} title={course.title} className="aspect-[16/9]" />
        <Badge tone={meta.tone} className="absolute top-3 left-3 shadow-sm">
          {meta.label}
        </Badge>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link href={`/learn/courses/${course.id}`}>
          <h3 className="line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-700">{course.title}</h3>
        </Link>
        {course.teacherName && <p className="mt-1 text-xs text-slate-500">Преподаватель: {course.teacherName}</p>}
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{course.shortDescription}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Icon name="book" className="size-4" /> {lessonsLabel(course.lessons)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Icon name="clock" className="size-4" /> {formatDuration(course.duration)}
          </span>
        </div>
        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-slate-500">
              {course.completed} из {course.lessons}
            </span>
            <span className="font-medium text-slate-700">{course.percent}%</span>
          </div>
          <ProgressBar value={course.percent} size="sm" />
          {blocked ? (
            <span className="btn-secondary mt-4 w-full cursor-not-allowed">
              <Icon name="lock" className="size-4" /> Доступ закрыт
            </span>
          ) : (
            <Link href={target} className="btn-primary mt-4 w-full">
              {cta}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
