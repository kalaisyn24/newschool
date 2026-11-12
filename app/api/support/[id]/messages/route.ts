import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Polling endpoint for the support chat: returns messages newer than ?after=<ISO date>. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/support/[id]/messages">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const conv = await db.conversation.findUnique({ where: { id } });
  const staff = user.role === "ADMIN" || user.role === "SUPPORT";
  if (!conv || (!staff && conv.studentId !== user.id)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : null;
  const messages = await db.message.findMany({
    where: { conversationId: id, ...(after && !Number.isNaN(after.getTime()) ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    include: { sender: { select: { name: true, role: true } } },
  });

  // mark as read for the viewer side
  if (staff && conv.unreadByStaff) await db.conversation.update({ where: { id }, data: { unreadByStaff: false } });
  if (!staff && conv.unreadByStudent) await db.conversation.update({ where: { id }, data: { unreadByStudent: false } });

  return NextResponse.json(
    {
      status: conv.status,
      messages: messages.map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
        senderId: m.senderId,
        senderName: m.sender.name,
        staff: m.sender.role !== "STUDENT",
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
