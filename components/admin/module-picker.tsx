"use client";

import { useState } from "react";

export type PickerModule = { id: string; title: string };

/**
 * Module access fields for a form: modulesMode = "all" | "some" and moduleId (repeated).
 * "All modules" also opens modules added to the course later.
 */
export function ModulePicker({
  modules,
  defaultAll = true,
  defaultSelected = [],
}: {
  modules: PickerModule[];
  defaultAll?: boolean;
  defaultSelected?: string[];
}) {
  const [mode, setMode] = useState<"all" | "some">(defaultAll ? "all" : "some");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(defaultSelected));
  if (!modules.length) return <input type="hidden" name="modulesMode" value="all" />;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <fieldset className="space-y-2 text-sm">
      <legend className="label mb-1 text-xs">Модули</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <label className="flex items-center gap-2 text-slate-700">
          <input type="radio" name="modulesMode" value="all" checked={mode === "all"} onChange={() => setMode("all")} className="accent-brand-600" />
          Все модули
        </label>
        <label className="flex items-center gap-2 text-slate-700">
          <input type="radio" name="modulesMode" value="some" checked={mode === "some"} onChange={() => setMode("some")} className="accent-brand-600" />
          Только выбранные
        </label>
      </div>
      {mode === "some" && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 flex gap-3 text-xs">
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setSelected(new Set(modules.map((m) => m.id)))}>
              Отметить все
            </button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setSelected(new Set())}>
              Снять все
            </button>
            <span className="ml-auto text-slate-400">Выбрано {selected.size} из {modules.length}</span>
          </div>
          <ul className="space-y-1.5">
            {modules.map((m, i) => (
              <li key={m.id}>
                <label className="flex items-start gap-2 text-slate-700">
                  <input
                    type="checkbox"
                    name="moduleId"
                    value={m.id}
                    checked={selected.has(m.id)}
                    onChange={() => toggle(m.id)}
                    className="mt-0.5 size-4 shrink-0 accent-brand-600"
                  />
                  <span>
                    <span className="text-slate-400">{i + 1}.</span> {m.title}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}

/** Course select + module picker for the selected course. */
export function CourseAccessFields({ courses }: { courses: (PickerModule & { modules: PickerModule[] })[] }) {
  const [courseId, setCourseId] = useState("");
  const course = courses.find((c) => c.id === courseId);
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="label text-xs">Курс</span>
        <select name="courseId" className="input" required value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="" disabled>Выберите курс…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </label>
      {course && <ModulePicker key={course.id} modules={course.modules} />}
    </div>
  );
}
