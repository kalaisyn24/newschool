import "server-only";
import { db } from "@/lib/db";
import { courseStatusFor, getCourseState, type CourseStatus } from "@/lib/learning";

export type MyCourse = {
  id: string;
  title: string;
  shortDescription: string;
  coverUrl: string | null;
  teacherName: string | null;
  lessons: number;
  modules: number;
  duration: number;
  completed: number;
  percent: number;
  status: CourseStatus;
  nextLessonId: string | null;
  lastLessonId: string | null;
  lastAccessAt: Date | null;
  completedAt: Date | null;
};

export async function getMyCourses(userId: string): Promise<MyCourse[]> {
  const enrollments = await db.enrollment.findMany({
    where: { userId },
    include: { course: { select: { published: true } } },
    orderBy: [{ lastAccessAt: "desc" }, { createdAt: "desc" }],
  });
  const result: MyCourse[] = [];
  for (const e of enrollments) {
    const state = await getCourseState(userId, e.courseId);
    if (!state) continue;
    const status = courseStatusFor(e, e.course.published, state.completedCount);
    result.push({
      id: state.course.id,
      title: state.course.title,
      shortDescription: state.course.shortDescription,
      coverUrl: state.course.coverUrl,
      teacherName: state.course.teacherName,
      lessons: state.total,
      modules: state.modules.length,
      duration: state.totalDuration,
      completed: state.completedCount,
      percent: state.percent,
      status,
      nextLessonId: state.nextLessonId,
      lastLessonId: e.lastLessonId,
      lastAccessAt: e.lastAccessAt,
      completedAt: e.completedAt,
    });
  }
  // blocked courses last
  return result.sort((a, b) => Number(a.status === "blocked") - Number(b.status === "blocked"));
}

export async function getLastLesson(userId: string) {
  const p = await db.lessonProgress.findFirst({
    where: {
      userId,
      lesson: {
        published: true,
        module: {
          course: { published: true },
          // the whole course is open, or this module is among the opened ones
          OR: [
            { course: { enrollments: { some: { userId, status: "ACTIVE", allModules: true } } } },
            { grants: { some: { enrollment: { userId, status: "ACTIVE" } } } },
          ],
        },
      },
    },
    orderBy: { lastViewedAt: "desc" },
    include: {
      lesson: {
        select: {
          id: true,
          title: true,
          durationSec: true,
          module: { select: { title: true, course: { select: { id: true, title: true, coverUrl: true } } } },
        },
      },
    },
  });
  return p;
}

export async function unreadNotifications(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}
