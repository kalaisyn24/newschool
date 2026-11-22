import { getCurrentUser } from "@/lib/auth";
import { getNavCounters } from "@/lib/nav-counters";

/** Menu badges (pending assignments, certificates, support requests) for staff. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  return Response.json(await getNavCounters(user), { headers: { "Cache-Control": "private, no-store" } });
}
