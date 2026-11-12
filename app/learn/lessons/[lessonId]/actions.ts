"use server";

import { db } from "@/lib/db";
import { requireLearner } from "@/lib/auth";
import { getLessonAccess, recomputeLesson } from "@/lib/learning";
import { logActivity } from "@/lib/activity";

export type TestResult = {
  error?: string;
  score?: number;
  correct?: number;
  total?: number;
  passed?: boolean;
  passingScore?: number;
  attemptsLeft?: number | null;
  /** questionId → { correct ids, was the answer right } (only when showAnswers is on) */
  review?: Record<string, { correctIds: string[]; right: boolean }>;
  lessonCompleted?: boolean;
};

export async function submitTest(lessonId: string, answers: Record<string, string[]>): Promise<TestResult> {
  const user = await requireLearner();
  const access = await getLessonAccess(user.id, lessonId, { preview: user.role === "ADMIN" });
  if (!access.ok) return { error: "Урок недоступен" };

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      title: true,
      videoUrl: true,
      requireVideo: true,
      test: { include: { questions: { include: { options: true } } } },
    },
  });
  const test = lesson?.test;
  if (!lesson || !test || test.questions.length === 0) return { error: "Тест не найден" };

  const progress = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
  if (lesson.videoUrl && lesson.requireVideo && !progress?.videoCompleted && user.role !== "ADMIN") {
    return { error: "Сначала посмотрите видео урока — тест станет доступен после просмотра." };
  }

  const used = await db.testAttempt.count({ where: { userId: user.id, testId: test.id } });
  if (test.maxAttempts && used >= test.maxAttempts) return { error: "Попытки закончились. Обратитесь к администратору." };

  let correct = 0;
  const review: NonNullable<TestResult["review"]> = {};
  const clean: Record<string, string[]> = {};
  for (const q of test.questions) {
    const valid = new Set(q.options.map((o) => o.id));
    const given = [...new Set((answers?.[q.id] ?? []).filter((id) => valid.has(id)))];
    const chosen = q.multiple ? given : given.slice(0, 1);
    clean[q.id] = chosen;
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const right = chosen.length === correctIds.length && correctIds.every((id) => chosen.includes(id));
    if (right) correct++;
    review[q.id] = { correctIds, right };
  }
  const total = test.questions.length;
  const score = Math.round((correct / total) * 100);
  const passed = score >= test.passingScore;

  await db.testAttempt.create({
    data: { userId: user.id, testId: test.id, score, correct, total, passed, answers: clean },
  });
  await logActivity(user.id, passed ? "test_passed" : "test_failed", `${lesson.title}: ${score}%`, `/learn/lessons/${lessonId}`);

  let lessonCompleted = Boolean(progress?.completedAt);
  if (passed) {
    await db.lessonProgress.upsert({
      where: { userId_lessonId: { userId: user.id, lessonId } },
      create: { userId: user.id, lessonId, testPassed: true },
      update: { testPassed: true },
    });
    await recomputeLesson(user.id, lessonId);
    const p = await db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } });
    lessonCompleted = Boolean(p?.completedAt);
  }

  return {
    score,
    correct,
    total,
    passed,
    passingScore: test.passingScore,
    attemptsLeft: test.maxAttempts ? test.maxAttempts - used - 1 : null,
    review: test.showAnswers ? review : undefined,
    lessonCompleted,
  };
}
