import type { LessonStatus } from "@/lib/learning";
import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui";

export const lessonStatusLabel: Record<LessonStatus, string> = {
  completed: "Пройден",
  available: "Доступен",
  locked: "Заблокирован",
};

export function LessonStatusIcon({ status, index }: { status: LessonStatus; index?: number }) {
  if (status === "completed")
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
        <Icon name="check" className="size-4" />
      </span>
    );
  if (status === "locked")
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon name="lock" className="size-4" />
      </span>
    );
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-brand-500 text-xs font-semibold text-brand-600">
      {index ?? <Icon name="play" className="size-3" />}
    </span>
  );
}

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const tone = status === "completed" ? "green" : status === "locked" ? "slate" : "brand";
  return <Badge tone={tone}>{lessonStatusLabel[status]}</Badge>;
}
