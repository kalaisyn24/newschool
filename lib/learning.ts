import "server-only";
import { db } from "@/lib/db";
import { notify, notifyAdmins, logActivity } from "@/lib/activity";
import { randomToken } from "@/lib/crypto";

export type LessonStatus = "completed" | "available" | "locked";
export type CourseStatus = "available" | "in_progress" | "completed" | "blocked";

type LessonForRules = {
  videoUrl: string | null;
  requireVideo: boolean;
  requireAssignment: boolean;
  assignment: string | null;
  test: { required: boolean; _count: { questions: number } } | null;
};

/** Which conditions must be met to complete a lesson. */
export function lessonRequirements(lesson: LessonForRules) {
  return {
    video: Boolean(lesson.videoUrl) && lesson.requireVideo,
    test: Boolean(lesson.test && lesson.test.required && lesson.test._count.questions > 0),
    assignment: Boolean(lesson.assignment && lesson.requireAssignment),
  };
}

const lessonSelect = {
  id: true,
  title: true,
  summary: true,
  durationSec: true,
  videoUrl: true,
  requireVideo: true,
  requiredWatchPct: true,
  requireAssignment: true,
  assignment: true,
  position: true,
  test: { select: { id: true, required: true, _count: { select: { questions: true } } } },
  _count: { select: { materials: true } },
} as const;

export async function getCourseTree(courseId: string) {
  return db.course.findUnique({
    where: { id: courseId },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: { lessons: { where: { published: true }, orderBy: { position: "asc" }, select: lessonSelect } },
      },
    },
  });
}

export type CourseTree = NonNullable<Awaited<ReturnType<typeof getCourseTree>>>;

export async function getEnrollment(userId: string, courseId: string) {
  return db.enrollment.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

export function enrollmentIsActive(e: { status: string; expiresAt: Date | null } | null) {
  return Boolean(e && e.status === "ACTIVE" && (!e.expiresAt || e.expiresAt > new Date()));
}

/** Builds the course with per-lesson statuses for the given user. */
export async function getCourseState(userId: string, courseId: string) {
  const course = await getCourseTree(courseId);
  if (!course) return null;
  const lessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
  const progress = await db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } } });
  const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

  let prevCompleted = true;
  let completedCount = 0;
  let nextLessonId: string | null = null;
  const modules = course.modules.map((m) => ({
    ...m,
    lessons: m.lessons.map((l) => {
      const p = byLesson.get(l.id);
      const completed = Boolean(p?.completedAt);
      let status: LessonStatus;
      if (completed) status = "completed";
      else if (!course.sequential || prevCompleted) status = "available";
      else status = "locked";
      if (completed) completedCount++;
      if (!nextLessonId && status === "available") nextLessonId = l.id;
      prevCompleted = completed;
      return { ...l, status, progress: p ?? null };
    }),
  }));
  const total = lessonIds.length;
  return {
    course,
    modules,
    total,
    completedCount,
    percent: total ? Math.round((completedCount / total) * 100) : 0,
    nextLessonId: nextLessonId as string | null,
    totalDuration: course.modules.reduce((s, m) => s + m.lessons.reduce((a, l) => a + l.durationSec, 0), 0),
  };
}

export type CourseState = NonNullable<Awaited<ReturnType<typeof getCourseState>>>;

export function courseStatusFor(
  enrollment: { status: string; expiresAt: Date | null; completedAt: Date | null; startedAt: Date | null } | null,
  coursePublished: boolean,
  completedCount: number,
): CourseStatus {
  if (!enrollmentIsActive(enrollment) || !coursePublished) return "blocked";
  if (enrollment!.completedAt) return "completed";
  if (enrollment!.startedAt || completedCount > 0) return "in_progress";
  return "available";
}

/** Resolves a lesson for a student: checks enrollment and lock state. */
export async function getLessonAccess(userId: string, lessonId: string, opts: { preview?: boolean } = {}) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: { id: true, published: true, module: { select: { courseId: true } } },
  });
  if (!lesson || (!lesson.published && !opts.preview)) return { ok: false as const, reason: "not_found" as const };
  const courseId = lesson.module.courseId;
  const course = await db.course.findUnique({ where: { id: courseId }, select: { published: true } });
  if (!opts.preview) {
    const enrollment = await getEnrollment(userId, courseId);
    if (!enrollmentIsActive(enrollment) || !course?.published)
      return { ok: false as const, reason: "no_access" as const, courseId };
  }
  const state = await getCourseState(userId, courseId);
  if (!state) return { ok: false as const, reason: "not_found" as const };
  const flat = state.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const index = flat.findIndex((l) => l.id === lessonId);
  const entry = flat[index];
  if (!entry && !opts.preview) return { ok: false as const, reason: "not_found" as const };
  if (entry?.status === "locked" && !opts.preview) return { ok: false as const, reason: "locked" as const, courseId };
  return {
    ok: true as const,
    courseId,
    state,
    entry,
    prev: index > 0 ? flat[index - 1] : null,
    next: index >= 0 && index < flat.length - 1 ? flat[index + 1] : null,
    position: index + 1,
  };
}

/**
 * Re-evaluates completion of a lesson after progress changed (video, test, assignment)
 * and propagates to course completion.
 */
export async function recomputeLesson(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      title: true,
      videoUrl: true,
      requireVideo: true,
      requireAssignment: true,
      assignment: true,
      module: { select: { courseId: true } },
      test: { select: { required: true, _count: { select: { questions: true } } } },
    },
  });
  if (!lesson) return;
  const req = lessonRequirements(lesson);
  const progress = await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: {},
  });
  let assignmentOk = true;
  if (req.assignment) {
    const sub = await db.assignmentSubmission.findFirst({
      where: { userId, lessonId, status: { in: ["SUBMITTED", "ACCEPTED"] } },
      select: { id: true },
    });
    assignmentOk = Boolean(sub);
  }
  const done =
    (!req.video || progress.videoCompleted) && (!req.test || progress.testPassed) && assignmentOk;

  if (done && !progress.completedAt) {
    await db.lessonProgress.update({ where: { id: progress.id }, data: { completedAt: new Date() } });
    await logActivity(userId, "lesson_completed", lesson.title, `/learn/lessons/${lesson.id}`);
    await recomputeCourse(userId, lesson.module.courseId);
  }
}

export async function recomputeCourse(userId: string, courseId: string) {
  const enrollment = await getEnrollment(userId, courseId);
  if (!enrollment || enrollment.completedAt) return;
  const state = await getCourseState(userId, courseId);
  if (!state || state.total === 0 || state.completedCount < state.total) return;
  await db.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: new Date() } });
  await logActivity(userId, "course_completed", state.course.title, `/learn/courses/${courseId}`);
  if (!state.course.certificateEnabled) {
    await notify(
      userId,
      `Курс «${state.course.title}» пройден!`,
      "Поздравляем с успешным завершением курса.",
      `/learn/courses/${courseId}`,
    );
    return;
  }

  const { certificate, created } = await requestCertificate(userId, courseId);
  if (certificate.issuedAt) {
    // The certificate was already issued earlier (e.g. progress was reset and the course re-completed).
    await notify(
      userId,
      `Курс «${state.course.title}» пройден!`,
      "Поздравляем! Ваш сертификат доступен в разделе «Сертификаты».",
      `/learn/certificates/${certificate.id}`,
    );
    return;
  }
  await notify(
    userId,
    `Курс «${state.course.title}» пройден!`,
    "Поздравляем! Сертификат готовится администратором — мы сообщим, как только он будет загружен.",
    `/learn/certificates`,
  );
  if (created) {
    const student = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
    await notifyAdmins(
      `Нужен сертификат: ${student?.name ?? "студент"} — «${state.course.title}»`,
      `Студент ${student?.name ?? ""} (${student?.email ?? ""}) завершил курс. Загрузите PDF-сертификат.`,
      `/admin/certificates`,
    );
  }
}

/** Creates a pending certificate (without a file) for a completed course. Idempotent. */
export async function requestCertificate(userId: string, courseId: string) {
  const existing = await db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
  if (existing) return { certificate: existing, created: false };
  const year = new Date().getFullYear();
  const number = `OS-${year}-${randomToken(6).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()}`;
  const certificate = await db.certificate.create({ data: { userId, courseId, number } });
  return { certificate, created: true };
}

/** Mark a lesson as opened: updates last-visit data and completes lessons without conditions. */
export async function touchLesson(userId: string, lessonId: string, courseId: string) {
  const now = new Date();
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: { lastViewedAt: now },
  });
  await db.enrollment.updateMany({
    where: { userId, courseId },
    data: { lastLessonId: lessonId, lastAccessAt: now },
  });
  await db.enrollment.updateMany({ where: { userId, courseId, startedAt: null }, data: { startedAt: now } });
  await recomputeLesson(userId, lessonId);
}

/** Merge watched [start,end] ranges (seconds). */
export function mergeRanges(ranges: [number, number][]): [number, number][] {
  const sorted = ranges
    .filter((r) => Array.isArray(r) && r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > r[0])
    .map(([a, b]) => [Math.max(0, Math.floor(a)), Math.ceil(b)] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1] + 1) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function coveredSeconds(ranges: [number, number][], duration: number) {
  return ranges.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, duration) - Math.min(a, duration)), 0);
}
