import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, Badge, PageHeader } from "@/components/ui";
import { Chat } from "@/components/chat";
import { SubmitButton } from "@/components/forms";
import { formatDate, formatDateTime } from "@/lib/format";
import { assignToMe, sendMessage, setConversationStatus } from "@/lib/support-actions";

export default async function StaffConversationPage({ params }: PageProps<"/support/[id]">) {
  const user = await requireRole("ADMIN", "SUPPORT");
  const { id } = await params;
  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      agent: { select: { name: true } },
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          blocked: true,
          emailVerified: true,
          createdAt: true,
          lastSeenAt: true,
          enrollments: { select: { status: true, completedAt: true, course: { select: { title: true } } } },
        },
      },
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true, role: true } } } },
    },
  });
  if (!conv) notFound();
  if (conv.unreadByStaff) await db.conversation.update({ where: { id }, data: { unreadByStaff: false } });
  const s = conv.student;

  return (
    <>
      <PageHeader
        back={{ href: "/support", label: "Все обращения" }}
        title={conv.subject}
        subtitle={`Создано ${formatDateTime(conv.createdAt)}${conv.agent ? ` · ответственный: ${conv.agent.name}` : ""}`}
        actions={
          <>
            {conv.agentId !== user.id && (
              <form action={assignToMe.bind(null, conv.id)}>
                <SubmitButton className="btn-secondary">Взять в работу</SubmitButton>
              </form>
            )}
            <form action={setConversationStatus.bind(null, conv.id, conv.status === "OPEN" ? "CLOSED" : "OPEN")}>
              <SubmitButton className={conv.status === "OPEN" ? "btn-primary" : "btn-secondary"}>
                {conv.status === "OPEN" ? "Закрыть обращение" : "Открыть снова"}
              </SubmitButton>
            </form>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Chat
          conversationId={conv.id}
          meId={user.id}
          closed={conv.status === "CLOSED"}
          viewerIsStaff
          send={sendMessage}
          initial={conv.messages.map((m) => ({
            id: m.id,
            body: m.body,
            createdAt: m.createdAt.toISOString(),
            senderId: m.senderId,
            senderName: m.sender.name,
            staff: m.sender.role !== "STUDENT",
          }))}
        />
        <aside className="card h-fit p-5">
          <div className="flex items-center gap-3">
            <Avatar name={s.name} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{s.name}</p>
              <p className="truncate text-xs text-slate-500">{s.email}</p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            {s.phone && <Row label="Телефон">{s.phone}</Row>}
            <Row label="Регистрация">{formatDate(s.createdAt)}</Row>
            <Row label="Последний визит">{formatDateTime(s.lastSeenAt)}</Row>
            <Row label="E-mail">{s.emailVerified ? "подтверждён" : <span className="text-amber-600">не подтверждён</span>}</Row>
            {s.blocked && <Row label="Статус"><Badge tone="red">Заблокирован</Badge></Row>}
          </dl>
          <p className="mt-4 mb-2 text-xs font-medium text-slate-400 uppercase">Курсы</p>
          <ul className="space-y-1.5 text-sm">
            {s.enrollments.length === 0 && <li className="text-slate-400">Нет курсов</li>}
            {s.enrollments.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{e.course.title}</span>
                {e.status === "REVOKED" ? <Badge tone="red">закрыт</Badge> : e.completedAt ? <Badge tone="green">пройден</Badge> : <Badge tone="brand">активен</Badge>}
              </li>
            ))}
          </ul>
          {user.role === "ADMIN" && (
            <Link href={`/admin/users/${s.id}`} className="btn-secondary mt-5 w-full">Открыть в админке</Link>
          )}
        </aside>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right text-slate-800">{children}</dd>
    </div>
  );
}
