import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLessonAccess, lessonRequirements, touchLesson } from "@/lib/learning";
import { parseVideoUrl } from "@/lib/video";
import { testAttemptState } from "@/lib/test-attempts";
import { Alert, Badge, ProgressBar } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { VideoPlayer } from "@/components/video-player";
import { TestRunner } from "@/components/test-runner";
import { LessonStatusIcon } from "@/components/lesson-status";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { formatBytes, formatDateTime, formatDuration } from "@/lib/format";
import { submitAssignment } from "../../actions";
import { submitTest } from "./actions";

export default async function LessonPage({ params }: PageProps<"/learn/lessons/[lessonId]">) {
  const user = await requireLearner();
  const { lessonId } = await params;
  const gate = await getLessonAccess(user.id, lessonId, { preview: user.role === "ADMIN" });
  if (!gate.ok) {
    if (gate.reason === "not_found") notFound();
    redirect(gate.courseId ? `/learn/courses/${gate.courseId}` : "/learn/courses");
  }
  // admin preview: no locks and no progress tracking
  const isAdmin = gate.preview;

  // record the visit; may complete a lesson without conditions
  if (!isAdmin) await touchLesson(user.id, lessonId, gate.courseId);
  const fresh = isAdmin ? gate : await getLessonAccess(user.id, lessonId);
  const access = fresh.ok ? fresh : gate;

  const [lesson, progress, attempts, submissions] = await Promise.all([
    db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        materials: { orderBy: { createdAt: "asc" } },
        module: { select: { title: true } },
        test: {
          include: {
            questions: {
              orderBy: { position: "asc" },
              include: { options: { orderBy: { position: "asc" }, select: { id: true, text: true } } },
            },
          },
        },
      },
    }),
    db.lessonProgress.findUnique({ where: { userId_lessonId: { userId: user.id, lessonId } } }),
    db.testAttempt.findMany({
      where: { userId: user.id, test: { lessonId } },
      orderBy: { createdAt: "desc" },
    }),
    db.assignmentSubmission.findMany({ where: { userId: user.id, lessonId }, orderBy: { createdAt: "desc" } }),
  ]);
  if (!lesson) notFound();

  const { state, prev, next } = access;
  const video = parseVideoUrl(lesson.videoUrl);
  const req = lessonRequirements({ ...lesson, test: lesson.test ? { required: lesson.test.required, _count: { questions: lesson.test.questions.length } } : null });
  const completed = Boolean(progress?.completedAt);
  const testAvailable = !req.video || Boolean(progress?.videoCompleted) || isAdmin;
  const test = lesson.test && lesson.test.questions.length > 0 ? lesson.test : null;
  const attemptState = testAttemptState(attempts);
  const bestScore = attempts.reduce((m, a) => Math.max(m, a.score), 0);
  const nextOpen = next && (next.status !== "locked" || isAdmin);
  let n = 0;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="min-w-0 space-y-6">
        <div>
          <Link href={`/learn/courses/${access.courseId}`} className="text-sm text-slate-500 hover:text-slate-800">
            ← {state.course.title}
          </Link>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                {lesson.module.title} · Урок {access.position} из {state.total}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{lesson.title}</h1>
              {lesson.summary && <p className="mt-2 max-w-2xl text-slate-600">{lesson.summary}</p>}
            </div>
            {completed ? <Badge tone="green">✓ Урок пройден</Badge> : <Badge tone="brand">Доступен</Badge>}
          </div>
        </div>

        {video ? (
          <VideoPlayer
            lessonId={lesson.id}
            source={video}
            startAt={progress?.videoPosition ?? 0}
            initialPercent={progress?.videoPercent ?? 0}
            requiredPct={lesson.requiredWatchPct}
            requireVideo={req.video}
            watched={Boolean(progress?.videoCompleted)}
          />
        ) : lesson.videoUrl ? (
          <Alert tone="amber">Видео недоступно: ссылка не распознана. Сообщите в поддержку.</Alert>
        ) : null}

        {!completed && (req.video || req.test || req.assignment) && (
          <div className="card p-5">
            <p className="mb-3 text-sm font-semibold text-slate-900">Чтобы завершить урок:</p>
            <ul className="space-y-2 text-sm">
              {req.video && <Requirement done={Boolean(progress?.videoCompleted)}>Посмотрите не менее {lesson.requiredWatchPct}% видео</Requirement>}
              {req.test && <Requirement done={Boolean(progress?.testPassed)}>Сдайте тест (проходной балл {test?.passingScore}%)</Requirement>}
              {req.assignment && <Requirement done={submissions.some((s) => s.status !== "REJECTED")}>Отправьте практическое задание</Requirement>}
            </ul>
          </div>
        )}

        {lesson.content && (
          <section className="card p-5 sm:p-7">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Описание урока</h2>
            <Markdown text={lesson.content} />
          </section>
        )}

        {lesson.materials.length > 0 && (
          <section className="card p-5 sm:p-7">
            <h2 className="mb-3 text-lg font-semibold text-slate-900">Дополнительные материалы</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {lesson.materials.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.storageKey ? `/api/materials/${m.id}` : m.externalUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-200 hover:bg-brand-50/40"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon name="file" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-900">{m.title}</span>
                      <span className="block text-xs text-slate-500">
                        {m.storageKey ? `${(m.storageKey.split(".").pop() ?? "").toUpperCase()} ${formatBytes(m.size)}` : "Ссылка"}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {lesson.assignment && (
          <section className="card p-5 sm:p-7">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Практическое задание</h2>
              {req.assignment ? <Badge tone="amber">Обязательно</Badge> : <Badge>По желанию</Badge>}
            </div>
            <Markdown text={lesson.assignment} />
            {submissions.length > 0 && (
              <div className="mt-4 space-y-2">
                {submissions.map((s) => (
                  <div key={s.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">Отправлено {formatDateTime(s.createdAt)}</span>
                      <Badge tone={s.status === "ACCEPTED" ? "green" : s.status === "REJECTED" ? "red" : "amber"}>
                        {s.status === "ACCEPTED" ? "Принято" : s.status === "REJECTED" ? "На доработку" : "На проверке"}
                      </Badge>
                    </div>
                    <p className="whitespace-pre-line text-slate-700">{s.text}</p>
                    {s.feedback && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-slate-600"><b>Комментарий:</b> {s.feedback}</p>}
                  </div>
                ))}
              </div>
            )}
            {!submissions.some((s) => s.status === "ACCEPTED") && (
              <ActionForm action={submitAssignment} resetOnSuccess className="mt-4 space-y-3">
                <input type="hidden" name="lessonId" value={lesson.id} />
                <textarea name="text" rows={5} required className="input" placeholder="Опишите решение или вставьте ссылку на работу" />
                <SubmitButton pendingText="Отправляем…">Отправить решение</SubmitButton>
              </ActionForm>
            )}
          </section>
        )}

        {test && (
          <section id="lesson-test" className="card p-5 sm:p-7">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Тест по уроку</h2>
              <div className="flex gap-2">
                {progress?.testPassed && <Badge tone="green">Сдан</Badge>}
                {attempts.length > 0 && <Badge>Лучший результат: {bestScore}%</Badge>}
              </div>
            </div>
            {testAvailable ? (
              <TestRunner
                lessonId={lesson.id}
                questions={test.questions.map((q) => ({ id: q.id, text: q.text, multiple: q.multiple, options: q.options }))}
                passingScore={test.passingScore}
                attemptsLeft={isAdmin ? null : attemptState.attemptsLeft}
                lockedUntil={isAdmin ? null : attemptState.lockedUntil}
                alreadyPassed={Boolean(progress?.testPassed) || attemptState.passed}
                retakeAllowed={isAdmin}
                submit={submitTest}
              />
            ) : (
              <Alert tone="amber">Тест откроется после просмотра видео (не менее {lesson.requiredWatchPct}%).</Alert>
            )}
            {attempts.length > 0 && (
              <details className="mt-5 text-sm">
                <summary className="cursor-pointer text-slate-500 hover:text-slate-800">История попыток ({attempts.length})</summary>
                <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {attempts.map((a, i) => (
                    <li key={a.id} className="flex items-center justify-between px-3 py-2">
                      <span className="text-slate-600">Попытка {attempts.length - i} · {formatDateTime(a.createdAt)}</span>
                      <span className={a.passed ? "font-medium text-brand-700" : "text-rose-600"}>
                        {a.score}% ({a.correct}/{a.total})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {prev ? (
            <Link href={`/learn/lessons/${prev.id}`} className="btn-secondary">← {prev.title.length > 30 ? "Предыдущий урок" : prev.title}</Link>
          ) : <span />}
          {next ? (
            nextOpen ? (
              <Link href={`/learn/lessons/${next.id}`} className="btn-primary">Следующий урок →</Link>
            ) : (
              <span className="btn-secondary cursor-not-allowed opacity-60">
                <Icon name="lock" className="size-4" /> Следующий урок
              </span>
            )
          ) : completed ? (
            <Link href={`/learn/courses/${access.courseId}`} className="btn-primary">К странице курса</Link>
          ) : null}
        </div>
      </div>

      <aside className="hidden xl:block">
        <div className="card sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto">
          <div className="border-b border-slate-100 p-4">
            <p className="line-clamp-2 text-sm font-semibold text-slate-900">{state.course.title}</p>
            <div className="mt-2 flex items-center gap-2">
              <ProgressBar value={state.percent} size="sm" />
              <span className="text-xs text-slate-500">{state.percent}%</span>
            </div>
          </div>
          {state.modules.map((m) => (
            <div key={m.id} className="border-b border-slate-100 last:border-0">
              <p className="px-4 pt-3 pb-1 text-xs font-medium text-slate-400 uppercase">{m.title}</p>
              <ul className="pb-2">
                {m.lessons.map((l) => {
                  n++;
                  const current = l.id === lesson.id;
                  const st = isAdmin && l.status === "locked" ? "available" : l.status;
                  const row = (
                    <span className={`flex items-center gap-2.5 px-4 py-2 text-sm ${current ? "bg-brand-50 font-medium text-brand-700" : st === "locked" ? "text-slate-400" : "text-slate-700 hover:bg-slate-50"}`}>
                      <span className="scale-75"><LessonStatusIcon status={st} index={n} /></span>
                      <span className="line-clamp-2">{l.title}</span>
                    </span>
                  );
                  return <li key={l.id}>{st === "locked" ? row : <Link href={`/learn/lessons/${l.id}`}>{row}</Link>}</li>;
                })}
              </ul>
            </div>
          ))}
          {lesson.durationSec > 0 && <p className="px-4 py-3 text-xs text-slate-400">Длительность урока: {formatDuration(lesson.durationSec)}</p>}
        </div>
      </aside>
    </div>
  );
}

function Requirement({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2.5">
      <span className={`grid size-5 place-items-center rounded-full text-[11px] ${done ? "bg-emerald-500 text-white" : "border border-slate-300 text-transparent"}`}>✓</span>
      <span className={done ? "text-slate-400 line-through" : "text-slate-700"}>{children}</span>
    </li>
  );
}
