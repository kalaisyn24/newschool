import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui";
import { Chat } from "@/components/chat";
import { SubmitButton } from "@/components/forms";
import { sendMessage, setConversationStatus } from "@/lib/support-actions";

export default async function StudentConversationPage({ params }: PageProps<"/learn/support/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const conv = await db.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true, role: true } } } },
    },
  });
  if (!conv || conv.studentId !== user.id) notFound();
  if (conv.unreadByStudent) await db.conversation.update({ where: { id }, data: { unreadByStudent: false } });

  return (
    <>
      <PageHeader
        back={{ href: "/learn/support", label: "Все обращения" }}
        title={conv.subject}
        subtitle={conv.status === "OPEN" ? <Badge tone="green">Открыто</Badge> : <Badge>Закрыто</Badge>}
        actions={
          conv.status === "OPEN" && (
            <form action={setConversationStatus.bind(null, conv.id, "CLOSED")}>
              <SubmitButton className="btn-secondary">Вопрос решён</SubmitButton>
            </form>
          )
        }
      />
      <Chat
        conversationId={conv.id}
        meId={user.id}
        closed={conv.status === "CLOSED"}
        viewerIsStaff={false}
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
    </>
  );
}
