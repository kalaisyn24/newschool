"use client";

import { useState, useTransition } from "react";
import type { QuestionInput } from "@/app/admin/lessons/actions";
import { Spinner } from "@/components/forms";

type Option = { text: string; isCorrect: boolean };

export function QuestionEditor({
  testId,
  initial,
  save,
  onDone,
  submitLabel = "Сохранить вопрос",
}: {
  testId: string;
  initial?: { id: string; text: string; multiple: boolean; options: Option[] };
  save: (testId: string, input: QuestionInput) => Promise<{ error?: string; ok?: boolean }>;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const [text, setText] = useState(initial?.text ?? "");
  const [multiple, setMultiple] = useState(initial?.multiple ?? false);
  const [options, setOptions] = useState<Option[]>(
    initial?.options ?? [
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function setCorrect(i: number) {
    setOptions((prev) =>
      prev.map((o, k) => (multiple ? (k === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: k === i })),
    );
  }

  function submit() {
    setError(null);
    start(async () => {
      const r = await save(testId, { id: initial?.id, text, multiple, options });
      if (r.error) return setError(r.error);
      if (!initial) {
        setText("");
        setMultiple(false);
        setOptions([
          { text: "", isCorrect: true },
          { text: "", isCorrect: false },
        ]);
      }
      onDone?.();
    });
  }

  return (
    <div className="space-y-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Текст вопроса" className="input" />
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            checked={!multiple}
            onChange={() => {
              setMultiple(false);
              // keep only the first correct option
              setOptions((prev) => {
                const first = prev.findIndex((o) => o.isCorrect);
                return prev.map((o, k) => ({ ...o, isCorrect: k === (first < 0 ? 0 : first) }));
              });
            }}
            className="accent-brand-600"
          />
          Один правильный ответ
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={multiple} onChange={() => setMultiple(true)} className="accent-brand-600" />
          Несколько правильных ответов
        </label>
      </div>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type={multiple ? "checkbox" : "radio"}
              checked={o.isCorrect}
              onChange={() => setCorrect(i)}
              title="Правильный ответ"
              className="size-4 shrink-0 accent-emerald-600"
            />
            <input
              value={o.text}
              onChange={(e) => setOptions((prev) => prev.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
              placeholder={`Вариант ${i + 1}`}
              className={`input py-2 ${o.isCorrect ? "border-emerald-300 bg-emerald-50/40" : ""}`}
            />
            <button
              type="button"
              className="btn-ghost btn-sm text-slate-400"
              disabled={options.length <= 2}
              onClick={() => setOptions((prev) => prev.filter((_, k) => k !== i))}
              title="Удалить вариант"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Отметьте {multiple ? "все правильные варианты" : "правильный вариант"} слева.</p>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOptions((p) => [...p, { text: "", isCorrect: false }])} disabled={options.length >= 12}>
          + Вариант
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={submit} disabled={pending}>
          {pending && <Spinner />}
          {submitLabel}
        </button>
        {onDone && initial && (
          <button type="button" className="btn-ghost btn-sm" onClick={onDone}>
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}

export function EditableQuestion({
  testId,
  index,
  question,
  save,
  children,
}: {
  testId: string;
  index: number;
  question: { id: string; text: string; multiple: boolean; options: Option[] };
  save: (testId: string, input: QuestionInput) => Promise<{ error?: string; ok?: boolean }>;
  children?: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4">
        <QuestionEditor testId={testId} initial={question} save={save} onDone={() => setEditing(false)} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-slate-900">
          <span className="mr-1.5 text-slate-400">{index + 1}.</span>
          {question.text}
          <span className="ml-2 text-xs font-normal text-slate-400">{question.multiple ? "несколько ответов" : "один ответ"}</span>
        </p>
        <div className="flex shrink-0 gap-1">
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>Изменить</button>
          {children}
        </div>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {question.options.map((o, i) => (
          <li key={i} className={o.isCorrect ? "font-medium text-emerald-700" : "text-slate-600"}>
            {o.isCorrect ? "✓" : "○"} {o.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
