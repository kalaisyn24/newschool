import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { formatDateTime } from "@/lib/format";
import { markNotificationsRead } from "../actions";

export const metadata: Metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const user = await requireLearner();
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Уведомления"
        subtitle={unread ? `Непрочитанных: ${unread}` : "Все уведомления прочитаны"}
        actions={
          unread > 0 && (
            <form action={markNotificationsRead}>
              <SubmitButton className="btn-secondary">Отметить все прочитанными</SubmitButton>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState title="Уведомлений пока нет" />
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((n) => (
            <div key={n.id} className={`flex gap-4 p-4 sm:p-5 ${n.readAt ? "" : "bg-brand-50/40"}`}>
              <span className={`mt-2 size-2 shrink-0 rounded-full ${n.readAt ? "bg-slate-200" : "bg-brand-500"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{n.title}</p>
                {n.body && <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>}
                <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                  <span>{formatDateTime(n.createdAt)}</span>
                  {n.link && <Link href={n.link} className="link">Открыть →</Link>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
