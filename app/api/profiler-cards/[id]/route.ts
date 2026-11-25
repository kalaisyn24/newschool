import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

/** Protected download of a profiler ID card PDF: only its owner and administrators. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/profiler-cards/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const card = await db.profilerCard.findUnique({ where: { id }, include: { user: { select: { name: true } } } });
  if (!card?.fileKey) return new Response("Not found", { status: 404 });
  if (card.userId !== user.id && user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  try {
    const file = await readUpload(card.fileKey);
    const filename = encodeURIComponent(`Удостоверение профайлера — ${card.user.name}.pdf`.replace(/[\/:*?"<>|]/g, " "));
    const download = req.nextUrl.searchParams.has("download");
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.size),
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${filename}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
