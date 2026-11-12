"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/auth";
import { notify } from "@/lib/activity";
import { str, type ActionState } from "@/lib/action-state";
import { rateLimit } from "@/lib/rate-limit";

export type ChatMessage = {
  id: string;
  body: string;
  createdAt: string;
  senderId: string;
  senderName: string;
  staff: boolean;
};

async function loadConversationFor(userId: string, role: string, conversationId: string) {
  const conv = await db.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return null;
  const staff = role === "ADMIN" || role === "SUPPORT";
  if (!staff && conv.studentId !== userId) return null;
  return { conv, staff };
}

export async function createConversation(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z
    .object({
      subject: z.string().trim().min(3, "Укажите тему обращения").max(200),
      body: z.string().trim().min(2, "Напишите сообщение").max(5000),
    })
    .safeParse({ subject: str(fd, "subject"), body: str(fd, "body") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!rateLimit(`conv:${user.id}`, 10, 60 * 60e3).ok) return { error: "Слишком много обращений. Попробуйте позже." };
  const conv = await db.conversation.create({
    data: {
      subject: parsed.data.subject,
      studentId: user.id,
      messages: { create: { senderId: user.id, body: parsed.data.body } },
    },
  });
  redirect(`/learn/support/${conv.id}`);
}

export async function sendMessage(conversationId: string, body: string): Promise<{ error?: string; message?: ChatMessage }> {
  const user = await requireUser();
  const text = body.trim();
  if (!text) return { error: "Пустое сообщение" };
  if (text.length > 5000) return { error: "Сообщение слишком длинное" };
  if (!rateLimit(`msg:${user.id}`, 30, 60e3).ok) return { error: "Вы отправляете сообщения слишком часто" };
  const found = await loadConversationFor(user.id, user.role, conversationId);
  if (!found) return { error: "Диалог не найден" };
  const { conv, staff } = found;

  const msg = await db.message.create({ data: { conversationId, senderId: user.id, body: text } });
  await db.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: msg.createdAt,
      status: "OPEN", // a new message reopens the conversation
      ...(staff
        ? { unreadByStudent: true, unreadByStaff: false, agentId: conv.agentId ?? user.id }
        : { unreadByStaff: true, unreadByStudent: false }),
    },
  });
  if (staff && conv.studentId !== user.id) {
    await notify(conv.studentId, "Новый ответ техподдержки", `«${conv.subject}»`, `/learn/support/${conv.id}`);
  }
  return {
    message: {
      id: msg.id,
      body: msg.body,
      createdAt: msg.createdAt.toISOString(),
      senderId: user.id,
      senderName: user.name,
      staff,
    },
  };
}

export async function setConversationStatus(conversationId: string, status: "OPEN" | "CLOSED") {
  const user = await requireUser();
  const found = await loadConversationFor(user.id, user.role, conversationId);
  if (!found) return;
  await db.conversation.update({ where: { id: conversationId }, data: { status } });
  if (found.staff && status === "CLOSED") {
    await notify(found.conv.studentId, "Обращение закрыто", `«${found.conv.subject}»`, `/learn/support/${conversationId}`);
  }
  refresh();
}

export async function assignToMe(conversationId: string) {
  const user = await requireRole("ADMIN", "SUPPORT");
  await db.conversation.update({ where: { id: conversationId }, data: { agentId: user.id } });
  refresh();
}
