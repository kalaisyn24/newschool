import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Avatar, Badge, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Обращения" };

const filters = [
  { key: "open", label: "Открытые" },
  { key: "unassigned", label: "Без ответственного" },
  { key: "mine", label: "Мои" },
  { key: "closed", label: "Закрытые" },
  { key: "all", label: "Все" },
] as const;

export default async function SupportInbox({ searchParams }: PageProps<"/support">) {
  const user = await requireRole("ADMIN", "SUPPORT");
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "open";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where: Prisma.ConversationWhereInput = {};
  if (filter === "open") where.status = "OPEN";
  if (filter === "closed") where.status = "CLOSED";
  if (filter === "unassigned") Object.assign(where, { status: "OPEN", agentId: null });
  if (filter === "mine") where.agentId = user.id;
  if (q) {
    where.OR = [
      { subject: { contains: q } },
      { student: { name: { contains: q } } },
      { student: { email: { contains: q } } },
    ];
  }

  const [items, openCount, unreadCount, unassigned] = await Promise.all([
    db.conversation.findMany({
      where,
      orderBy: [{ unreadByStaff: "desc" }, { lastMessageAt: "desc" }],
      take: 100,
      include: {
        student: { select: { name: true, email: true } },
        agent: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true } },
      },
    }),
    db.conversation.count({ where: { status: "OPEN" } }),
    db.conversation.count({ where: { status: "OPEN", unreadByStaff: true } }),
    db.conversation.count({ where: { status: "OPEN", agentId: null } }),
  ]);

  return (
    <>
      <PageHeader title="Обращения пользователей" subtitle="Внутренний чат технической поддержки" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Открытые" value={openCount} />
        <StatCard label="Ждут ответа" value={unreadCount} />
        <StatCard label="Без ответственного" value={unassigned} />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="scroll-strip w-full sm:w-auto">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={`/support?filter=${f.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`shrink-0 rounded-full px-3.5 py-2 text-sm whitespace-nowrap ${filter === f.key ? "bg-ink text-white shadow-soft" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="filter" value={filter} />
          <input name="q" defaultValue={q} placeholder="Поиск по теме, имени, e-mail" className="input w-64" />
          <button className="btn-secondary">Найти</button>
        </form>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Обращений нет" text="Когда пользователи напишут в поддержку, диалоги появятся здесь." />
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((c) => (
            <Link key={c.id} href={`/support/${c.id}`} className="flex items-start gap-3 p-4 transition hover:bg-slate-50">
              <Avatar name={c.student.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`truncate text-slate-900 ${c.unreadByStaff ? "font-semibold" : "font-medium"}`}>
                    {c.unreadByStaff && <span className="mr-2 inline-block size-2 rounded-full bg-rose-500" />}
                    {c.subject}
                  </p>
                  <div className="flex items-center gap-2">
                    {c.agent && <Badge tone="blue">{c.agent.name}</Badge>}
                    {c.status === "OPEN" ? <Badge tone="green">Открыто</Badge> : <Badge>Закрыто</Badge>}
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {c.student.name} · {c.student.email} · {formatDateTime(c.lastMessageAt)}
                </p>
                <p className="mt-1 truncate text-sm text-slate-600">{c.messages[0]?.body}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
