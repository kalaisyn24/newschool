import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readUpload } from "@/lib/storage";

/** Protected download of an uploaded PDF certificate: only its owner and administrators. */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/certificates/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const cert = await db.certificate.findUnique({
    where: { id },
    include: { course: { select: { title: true } } },
  });
  if (!cert?.fileKey) return new Response("Not found", { status: 404 });
  if (cert.userId !== user.id && user.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  try {
    const file = await readUpload(cert.fileKey);
    const filename = encodeURIComponent(`Сертификат ${cert.number} — ${cert.course.title}.pdf`.replace(/[\/:*?"<>|]/g, " "));
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
