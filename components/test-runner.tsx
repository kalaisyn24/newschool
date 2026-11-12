"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { TestResult } from "@/app/learn/lessons/[lessonId]/actions";
import { Spinner } from "@/components/forms";
import { cx } from "@/components/ui";

type Q = { id: string; text: string; multiple: boolean; options: { id: string; text: string }[] };

export function TestRunner({
  lessonId,
  questions,
  passingScore,
  attemptsLeft,
  alreadyPassed,
  submit,
}: {
  lessonId: string;
  questions: Q[];
  passingScore: number;
  attemptsLeft: number | null;
  alreadyPassed: boolean;
  submit: (lessonId: string, answers: Record<string, string[]>) => Promise<TestResult>;
}) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [pending, start] = useTransition();
  const [left, setLeft] = useState(attemptsLeft);

  const answered = questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length;
  const noAttempts = left !== null && left <= 0;

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
    return (
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          <p>
            {questions.length} {questions.length === 1 ? "вопрос" : "вопросов"} · проходной балл {passingScore}%
          </p>
          <p className="text-slate-500">
            {left === null ? "Количество попыток не ограничено" : `Осталось попыток: ${Math.max(0, left)}`}
          </p>
        </div>
        <button className="btn-primary" disabled={noAttempts} onClick={() => setStarted(true)}>
          {alreadyPassed ? "Пройти ещё раз" : "Начать тест"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {result?.error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{result.error}</div>}
      {result && !result.error && (
        <div
          className={cx(
            "rounded-2xl border p-5",
            result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <p className={cx("text-lg font-semibold", result.passed ? "text-emerald-800" : "text-amber-800")}>
            {result.passed ? "Тест пройден! 🎉" : "Тест не пройден"}
          </p>
          <p className="mt-1 text-sm text-slate-700">
            Результат: <b>{result.score}%</b> ({result.correct} из {result.total}). Проходной балл — {result.passingScore}%.
          </p>
          {result.passed && result.lessonCompleted && <p className="mt-1 text-sm text-emerald-700">Урок завершён — следующий урок открыт.</p>}
          {!result.passed && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {left === null || left > 0 ? (
                <button className="btn-primary btn-sm" onClick={retry}>Пройти заново</button>
              ) : (
                <span className="text-sm text-slate-600">Попытки закончились. Обратитесь в поддержку.</span>
              )}
              {left !== null && left > 0 && <span className="text-xs text-slate-500">Осталось попыток: {left}</span>}
            </div>
          )}
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
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
                      rev
                        ? isCorrect
                          ? "border-emerald-300 bg-emerald-50"
                          : checked
                            ? "border-rose-300 bg-rose-50"
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
                    {rev && isCorrect && <span className="text-xs font-medium text-emerald-700">верно</span>}
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
