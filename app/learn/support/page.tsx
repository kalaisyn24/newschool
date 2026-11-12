import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { formatDateTime } from "@/lib/format";
import { createConversation } from "@/lib/support-actions";

export const metadata: Metadata = { title: "Техподдержка" };

export default async function StudentSupportPage() {
  const user = await requireUser();
  const conversations = await db.conversation.findMany({
    where: { studentId: user.id },
    orderBy: { lastMessageAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } } },
  });

  return (
    <>
      <PageHeader title="Техподдержка" subtitle="Задайте вопрос — специалисты ответят в этом чате" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 font-semibold text-slate-900">Мои обращения</h2>
          {conversations.length === 0 ? (
            <div className="card p-6 text-sm text-slate-500">Обращений пока нет. Создайте первое — форма справа.</div>
          ) : (
            <div className="card divide-y divide-slate-100">
              {conversations.map((c) => (
                <Link key={c.id} href={`/learn/support/${c.id}`} className="flex items-start gap-3 p-4 transition hover:bg-slate-50">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${c.unreadByStudent ? "bg-brand-500" : "bg-transparent"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate ${c.unreadByStudent ? "font-semibold" : "font-medium"} text-slate-900`}>{c.subject}</p>
                      {c.status === "OPEN" ? <Badge tone="green">Открыто</Badge> : <Badge>Закрыто</Badge>}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{c.messages[0]?.body}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(c.lastMessageAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="card h-fit p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Новое обращение</h2>
          <ActionForm action={createConversation} className="space-y-4">
            <Field label="Тема">
              <input name="subject" required className="input" placeholder="Например: не воспроизводится видео" />
            </Field>
            <Field label="Сообщение">
              <textarea name="body" required rows={5} className="input" placeholder="Опишите вопрос как можно подробнее" />
            </Field>
            <SubmitButton className="btn-primary w-full" pendingText="Отправляем…">Отправить</SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
