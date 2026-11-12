import type { NextRequest } from "next/server";
import { connection } from "next/server";
import { readUpload } from "@/lib/storage";

/** Public media (course covers). Only the "covers/" folder is exposed. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/media/[...key]">) {
  await connection();
  const { key } = await ctx.params;
  const path = key.join("/");
  if (!path.startsWith("covers/")) return new Response("Not found", { status: 404 });
  try {
    const file = await readUpload(path);
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
