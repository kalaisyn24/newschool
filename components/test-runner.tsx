"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TestResult } from "@/app/learn/lessons/[lessonId]/actions";
import { Spinner } from "@/components/forms";
import { cx } from "@/components/ui";
import { ATTEMPTS_PER_CYCLE, RETAKE_PAUSE_DAYS } from "@/lib/test-attempts";

/** Retake date in the student's own time zone. */
function RetakeDate({ iso }: { iso: string }) {
  return (
    <b suppressHydrationWarning>
      {new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
    </b>
  );
}

function LockedNotice({ until }: { until: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">Обе попытки использованы — тест временно недоступен.</p>
      <p className="mt-1">
        Повторите материал урока: пересмотрите видео и конспект. Пересдать тест можно будет <RetakeDate iso={until} />, у вас снова
        будет {ATTEMPTS_PER_CYCLE} попытки.
      </p>
    </div>
  );
}

type Q = { id: string; text: string; multiple: boolean; options: { id: string; text: string }[] };

export function TestRunner({
  lessonId,
  questions,
  passingScore,
  attemptsLeft,
  lockedUntil,
  alreadyPassed,
  retakeAllowed,
  submit,
}: {
  lessonId: string;
  questions: Q[];
  passingScore: number;
  /** null — no limit (admin preview). */
  attemptsLeft: number | null;
  lockedUntil: string | null;
  alreadyPassed: boolean;
  /** Admins may take a passed test again. */
  retakeAllowed?: boolean;
  submit: (lessonId: string, answers: Record<string, string[]>) => Promise<TestResult>;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();
  const [left, setLeft] = useState(attemptsLeft);
  const [locked, setLocked] = useState(lockedUntil);

  const answered = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;

  function toggle(q: Q, optionId: string) {
    if (result) return;
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      const next = q.multiple ? (cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]) : [optionId];
      return { ...prev, [q.id]: next };
    });
  }

  function onSubmit() {
    start(async () => {
      const r = await submit(lessonId, answers);
      setResult(r);
      if (r.attemptsLeft !== undefined) setLeft(r.attemptsLeft);
      if (r.lockedUntil !== undefined) setLocked(r.lockedUntil);
      if (!r.error) {
        window.scrollTo({ top: (document.getElementById("lesson-test")?.offsetTop ?? 0) - 20, behavior: "smooth" });
        router.refresh();
      }
    });
  }

  function retry() {
    setAnswers({});
    setResult(null);
    setStarted(true);
  }

  if (!started && !result) {
    if (alreadyPassed && !retakeAllowed) {
      return <p className="text-sm text-slate-600">Тест сдан — можно переходить к следующему уроку.</p>;
    }
    if (locked) return <LockedNotice until={locked} />;
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {questions.length} {questions.length === 1 ? "вопрос" : "вопросов"} · проходной балл {passingScore}%
        </p>
        {left !== null && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">
              {left < ATTEMPTS_PER_CYCLE
                ? "Внимание: это последняя попытка."
                : `Внимание: у вас ${ATTEMPTS_PER_CYCLE} попытки — право на одну ошибку.`}
            </p>
            <p className="mt-1">
              Если тест не будет сдан, он станет недоступен на {RETAKE_PAUSE_DAYS} дня. За это время повторите урок, после паузы у вас
              снова будет {ATTEMPTS_PER_CYCLE} попытки. Начинайте, когда будете готовы.
            </p>
          </div>
        )}
        <button className="btn-primary" onClick={() => setStarted(true)}>
          {alreadyPassed ? "Пройти ещё раз" : left !== null && left < ATTEMPTS_PER_CYCLE ? "Начать последнюю попытку" : "Начать тест"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {result?.error &&
        (locked ? (
          <LockedNotice until={locked} />
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{result.error}</div>
        ))}
      {result && !result.error && (
        <div
          className={cx(
            "rounded-2xl border p-5",
            result.passed ? "border-brand-300 bg-gradient-to-br from-brand-100 to-sky-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <p className={cx("text-lg font-semibold", "text-slate-900")}>
            {result.passed ? "Тест пройден! 🎉" : "Тест не пройден"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Результат: <b>{result.score}%</b> ({result.correct} из {result.total}). Проходной балл — {result.passingScore}%.
          </p>
          {result.passed && result.lessonCompleted && <p className="mt-1 text-sm text-emerald-700">Урок завершён — следующий урок открыт.</p>}
          {!result.passed &&
            (locked ? (
              <div className="mt-3">
                <LockedNotice until={locked} />
              </div>
            ) : left === null || left > 0 ? (
              <div className="mt-3 space-y-2">
                {left !== null && (
                  <p className="text-sm text-slate-700">
                    Осталась последняя попытка. Перед ней рекомендуем ещё раз просмотреть материал урока.
                  </p>
                )}
                <button className="btn-primary btn-sm" onClick={retry}>
                  {left === null ? "Пройти заново" : "Использовать последнюю попытку"}
                </button>
              </div>
            ) : null)}
        </div>
      )}

      {questions.map((q, i) => {
        const rev = result?.review?.[q.id];
        return (
          <fieldset key={q.id} className="rounded-2xl border border-slate-200 p-4 sm:p-5">
            <legend className="sr-only">Вопрос {i + 1}</legend>
            <p className="font-medium text-slate-900">
              <span className="mr-2 text-slate-400">{i + 1}.</span>
              {q.text}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{q.multiple ? "Выберите все правильные ответы" : "Выберите один ответ"}</p>
            <div className="mt-3 space-y-2">
              {q.options.map((o) => {
                const checked = answers[q.id]?.includes(o.id) ?? false;
                const isCorrect = rev?.correctIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className={cx(
                      "flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
                      rev
                        ? isCorrect
                          ? "border-2 border-brand-600 bg-brand-100"
                          : checked
                            ? "border-2 border-rose-300 bg-rose-50"
                            : "border-slate-200"
                        : checked
                          ? "border-brand-400 bg-brand-50"
                          : "border-slate-200 hover:bg-slate-50",
                    )}
                  >
                    <input
                      type={q.multiple ? "checkbox" : "radio"}
                      name={q.id}
                      checked={checked}
                      onChange={() => toggle(q, o.id)}
                      disabled={Boolean(result)}
                      className="size-4 accent-brand-600"
                    />
                    <span className="flex-1">{o.text}</span>
                    {rev && isCorrect && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-800 ring-1 ring-brand-300">верно</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {!result && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            Отвечено: {answered} из {questions.length}
          </span>
          <button className="btn-primary" disabled={pending || answered < questions.length} onClick={onSubmit}>
            {pending && <Spinner />}
            Завершить тест
          </button>
        </div>
      )}
    </div>
  );
}
