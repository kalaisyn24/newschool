import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { formatDateTime } from "@/lib/format";
import { reviewSubmission } from "@/lib/assignment-actions";

const tabs = [
  { key: "SUBMITTED", label: "На проверке" },
  { key: "ACCEPTED", label: "Принятые" },
  { key: "REJECTED", label: "На доработке" },
] as const;

/**
 * Practical assignments review screen, shared by the admin and support areas.
 * `adminLinks` — link students and lessons to admin pages (support staff have no access there).
 */
export async function AssignmentReview({
  basePath,
  statusParam,
  adminLinks,
}: {
  basePath: string;
  statusParam: string | string[] | undefined;
  adminLinks: boolean;
}) {
  const status = tabs.find((t) => t.key === statusParam)?.key ?? "SUBMITTED";
  const items = await db.assignmentSubmission.findMany({
    where: { status },
    orderBy: { createdAt: status === "SUBMITTED" ? "asc" : "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      lesson: { select: { id: true, title: true, assignment: true, module: { select: { course: { select: { title: true } } } } } },
    },
  });

  return (
    <>
      <PageHeader title="Практические задания" subtitle="Проверка решений студентов" />
      <div className="scroll-strip mb-5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`${basePath}?status=${t.key}`}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm whitespace-nowrap ${status === t.key ? "bg-ink text-white shadow-soft" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState title="Здесь пусто" text={status === "SUBMITTED" ? "Новых решений на проверку нет." : undefined} />
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  {adminLinks ? (
                    <Link href={`/admin/users/${s.user.id}`} className="font-semibold text-slate-900 hover:text-brand-700">{s.user.name}</Link>
                  ) : (
                    <p className="font-semibold text-slate-900">
                      {s.user.name} <span className="text-xs font-normal text-slate-500">{s.user.email}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-500">
                    {s.lesson.module.course.title} ·{" "}
                    {adminLinks ? <Link className="link" href={`/admin/lessons/${s.lesson.id}`}>{s.lesson.title}</Link> : s.lesson.title} ·{" "}
                    {formatDateTime(s.createdAt)}
                  </p>
                </div>
                <Badge tone={s.status === "ACCEPTED" ? "green" : s.status === "REJECTED" ? "red" : "amber"}>
                  {tabs.find((t) => t.key === s.status)?.label}
                </Badge>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-slate-500">Текст задания</summary>
                <p className="mt-1 whitespace-pre-line text-slate-600">{s.lesson.assignment}</p>
              </details>
              <div className="mt-3 rounded-xl bg-slate-50 p-4 text-sm whitespace-pre-line text-slate-800">{s.text}</div>
              {s.feedback && <p className="mt-2 text-sm text-slate-600"><b>Комментарий:</b> {s.feedback}</p>}
              {s.status === "SUBMITTED" && (
                <ActionForm action={reviewSubmission.bind(null, s.id)} className="mt-4 space-y-2">
                  <textarea name="feedback" rows={2} className="input" placeholder="Комментарий для студента (необязательно)" />
                  <div className="flex gap-2">
                    <SubmitButton name="decision" value="ACCEPTED">Принять</SubmitButton>
                    <SubmitButton name="decision" value="REJECTED" className="btn-secondary">Вернуть на доработку</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
