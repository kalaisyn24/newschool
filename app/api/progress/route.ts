import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { coveredSeconds, getLessonAccess, mergeRanges, recomputeLesson } from "@/lib/learning";

type Body = {
  lessonId?: string;
  position?: number;
  duration?: number;
  ranges?: [number, number][];
};

/** Saves video progress. Called periodically by the player and via sendBeacon on page hide. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const lessonId = String(body.lessonId ?? "");
  const access = await getLessonAccess(user.id, lessonId, { preview: user.role === "ADMIN" });
  if (!access.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { durationSec: true, requiredWatchPct: true },
  });
  if (!lesson) return NextResponse.json({ error: "not found" }, { status: 404 });

  const reported = Math.floor(Number(body.duration) || 0);
  const duration = reported > 0 ? reported : lesson.durationSec;
  if (reported > 0 && lesson.durationSec === 0) {
    // fill lesson duration automatically from the player
    await db.lesson.update({ where: { id: lessonId }, data: { durationSec: reported } });
  }

  const existing = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  const incoming = Array.isArray(body.ranges) ? body.ranges.slice(0, 500) : [];
  const ranges = mergeRanges([...(((existing?.watchedRanges as [number, number][] | null) ?? [])), ...incoming]).slice(0, 1000);
  const percent = duration > 0 ? Math.min(100, Math.round((coveredSeconds(ranges, duration) / duration) * 100)) : 0;
  let position = Math.max(0, Math.floor(Number(body.position) || 0));
  if (duration > 0 && position >= duration - 5) position = 0; // finished — restart from the beginning next time
  const videoCompleted = Boolean(existing?.videoCompleted) || (duration > 0 && percent >= lesson.requiredWatchPct);

  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    create: { userId: user.id, lessonId, videoPosition: position, videoDuration: duration, watchedRanges: ranges, videoPercent: percent, videoCompleted },
    update: { videoPosition: position, videoDuration: duration, watchedRanges: ranges, videoPercent: Math.max(percent, existing?.videoPercent ?? 0), videoCompleted, lastViewedAt: new Date() },
  });
  const wasCompleted = Boolean(existing?.completedAt);
  if (videoCompleted && !existing?.videoCompleted) await recomputeLesson(user.id, lessonId);
  const after = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId: user.id, lessonId } },
    select: { completedAt: true },
  });

  return NextResponse.json({
    percent,
    videoCompleted,
    lessonCompleted: Boolean(after?.completedAt),
    justCompleted: !wasCompleted && Boolean(after?.completedAt),
    justWatched: videoCompleted && !existing?.videoCompleted,
  });
}
