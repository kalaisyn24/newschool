import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, PageHeader } from "@/components/ui";
import { ActionForm, ConfirmButton, Field, SubmitButton, Toggle } from "@/components/forms";
import { EditableQuestion, QuestionEditor } from "@/components/admin/question-editor";
import { formatBytes } from "@/lib/format";
import { parseVideoUrl } from "@/lib/video";
import { ATTEMPTS_PER_CYCLE, RETAKE_PAUSE_DAYS } from "@/lib/test-attempts";
import { deleteLesson } from "../../courses/actions";
import {
  addMaterial,
  deleteMaterial,
  deleteQuestion,
  deleteTest,
  moveQuestion,
  saveQuestion,
  saveTestSettings,
  updateLesson,
} from "../actions";

export default async function LessonEditorPage({ params }: PageProps<"/admin/lessons/[id]">) {
  await requireRole("ADMIN");
  const { id } = await params;
  const lesson = await db.lesson.findUnique({
    where: { id },
    include: {
      module: { include: { course: { include: { modules: { orderBy: { position: "asc" }, select: { id: true, title: true } } } } } },
      materials: { orderBy: { createdAt: "asc" } },
      test: {
        include: {
          questions: { orderBy: { position: "asc" }, include: { options: { orderBy: { position: "asc" } } } },
          _count: { select: { attempts: true } },
        },
      },
    },
  });
  if (!lesson) notFound();
  const course = lesson.module.course;
  const video = parseVideoUrl(lesson.videoUrl);

  return (
    <>
      <PageHeader
        back={{ href: `/admin/courses/${course.id}`, label: course.title }}
        title={lesson.title}
        subtitle={`Модуль: ${lesson.module.title}`}
        actions={
          <>
            {!lesson.published && <Badge tone="amber">Скрыт</Badge>}
            <Link href={`/learn/lessons/${lesson.id}`} target="_blank" className="btn-secondary">Предпросмотр</Link>
          </>
        }
      />

      <div className="space-y-6">
        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Содержание урока</h2>
          <ActionForm action={updateLesson.bind(null, lesson.id)} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
              <Field label="Название урока">
                <input name="title" defaultValue={lesson.title} required className="input" />
              </Field>
              <Field label="Модуль">
                <select name="moduleId" defaultValue={lesson.moduleId} className="input">
                  {course.modules.map((m) => (
                    <option key={m.id} value={m.id}>{m.title}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Краткое описание" hint="Необязательно">
              <input name="summary" defaultValue={lesson.summary ?? ""} className="input" />
            </Field>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 font-medium text-slate-900">Видео</p>
              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <Field label="Ссылка на YouTube или Vimeo" hint={video ? `Распознано: ${video.provider === "youtube" ? "YouTube" : "Vimeo"}, ID ${video.id}` : "Например: https://www.youtube.com/watch?v=… или https://vimeo.com/123456"}>
                  <input name="videoUrl" defaultValue={lesson.videoUrl ?? ""} className="input" placeholder="https://" />
                </Field>
                <div>
                  <span className="label">Длительность</span>
                  <div className="flex items-center gap-2">
                    <input name="durationMin" type="number" min={0} defaultValue={Math.floor(lesson.durationSec / 60)} className="input" aria-label="Минуты" />
                    <span className="text-sm text-slate-500">мин</span>
                    <input name="durationSec" type="number" min={0} max={59} defaultValue={lesson.durationSec % 60} className="input" aria-label="Секунды" />
                    <span className="text-sm text-slate-500">сек</span>
                  </div>
                  <p className="hint">Заполнится автоматически при первом просмотре</p>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_200px]">
                <Toggle name="requireVideo" defaultChecked={lesson.requireVideo} label="Обязательный просмотр видео" hint="Урок засчитывается только после просмотра" />
                <Field label="Требуемый % просмотра">
                  <input name="requiredWatchPct" type="number" min={1} max={100} defaultValue={lesson.requiredWatchPct} className="input" />
                </Field>
              </div>
            </div>

            <Field label="Текст урока" hint="Разметка: # заголовок, - список, 1. нумерованный, **жирный**, *курсив*, `код`, [ссылка](https://…)">
              <textarea name="content" defaultValue={lesson.content ?? ""} rows={10} className="input font-mono text-[13px]" />
            </Field>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 font-medium text-slate-900">Практическое задание</p>
              <textarea name="assignment" defaultValue={lesson.assignment ?? ""} rows={4} className="input" placeholder="Оставьте пустым, если задания нет" />
              <div className="mt-3">
                <Toggle name="requireAssignment" defaultChecked={lesson.requireAssignment} label="Обязательно для завершения урока" hint="Урок засчитывается после отправки решения (если его не вернули на доработку)" />
              </div>
            </div>

            <Toggle name="published" defaultChecked={lesson.published} label="Урок опубликован" hint="Скрытые уроки не видны студентам и не учитываются в прогрессе" />
            <SubmitButton pendingText="Сохраняем…">Сохранить урок</SubmitButton>
          </ActionForm>
        </section>

        <section className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Дополнительные материалы</h2>
          {lesson.materials.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {lesson.materials.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <a href={m.storageKey ? `/api/materials/${m.id}` : m.externalUrl!} target="_blank" rel="noopener noreferrer" className="link truncate">
                    {m.title}
                  </a>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-slate-400">{m.storageKey ? formatBytes(m.size) : "ссылка"}</span>
                    <form action={deleteMaterial.bind(null, m.id)}>
                      <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Удалить материал?">Удалить</ConfirmButton>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={addMaterial.bind(null, lesson.id)} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            <Field label="Название" hint="Если пусто — имя файла">
              <input name="title" className="input" />
            </Field>
            <Field label="Файл" hint="PDF, документы, таблицы, презентации, изображения, архивы — до 50 МБ">
              <input name="file" type="file" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
            </Field>
            <Field label="…или внешняя ссылка" className="sm:col-span-2">
              <input name="url" className="input" placeholder="https://" />
            </Field>
            <div className="sm:col-span-2"><SubmitButton className="btn-secondary" pendingText="Загружаем…">Добавить материал</SubmitButton></div>
          </ActionForm>
        </section>

        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Тест</h2>
            {lesson.test && <span className="text-sm text-slate-500">Попыток студентов: {lesson.test._count.attempts}</span>}
          </div>
          <ActionForm action={saveTestSettings.bind(null, lesson.id)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Проходной балл, %">
              <input name="passingScore" type="number" min={1} max={100} defaultValue={lesson.test?.passingScore ?? 70} className="input" />
            </Field>
            <div className="text-sm text-slate-600">
              <span className="label">Попытки</span>
              {ATTEMPTS_PER_CYCLE} попытки; после неудачных — пауза {RETAKE_PAUSE_DAYS} дня, затем снова {ATTEMPTS_PER_CYCLE}
            </div>
            <Toggle name="required" defaultChecked={lesson.test?.required ?? true} label="Обязательный" hint="Нужно сдать для завершения урока" />
            <Toggle name="showAnswers" defaultChecked={lesson.test?.showAnswers ?? true} label="Показывать ответы" hint="Только после успешной сдачи теста" />
            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <SubmitButton className="btn-secondary">{lesson.test ? "Сохранить настройки" : "Создать тест"}</SubmitButton>
            </div>
          </ActionForm>

          {lesson.test && (
            <>
              <div className="mt-6 space-y-3">
                {lesson.test.questions.map((q, i) => (
                  <EditableQuestion
                    key={q.id + q.options.map((o) => o.id).join()}
                    testId={lesson.test!.id}
                    index={i}
                    save={saveQuestion}
                    question={{ id: q.id, text: q.text, multiple: q.multiple, options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) }}
                  >
                    <form action={moveQuestion.bind(null, q.id, -1)}><button className="btn-ghost btn-sm" disabled={i === 0}>↑</button></form>
                    <form action={moveQuestion.bind(null, q.id, 1)}><button className="btn-ghost btn-sm" disabled={i === lesson.test!.questions.length - 1}>↓</button></form>
                    <form action={deleteQuestion.bind(null, q.id)}>
                      <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Удалить вопрос?">✕</ConfirmButton>
                    </form>
                  </EditableQuestion>
                ))}
                {lesson.test.questions.length === 0 && <p className="text-sm text-slate-500">В тесте пока нет вопросов — добавьте первый ниже.</p>}
              </div>
              <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4">
                <p className="mb-3 font-medium text-slate-900">Новый вопрос</p>
                <QuestionEditor testId={lesson.test.id} save={saveQuestion} submitLabel="Добавить вопрос" />
              </div>
              <form action={deleteTest.bind(null, lesson.id)} className="mt-5">
                <ConfirmButton className="btn-ghost btn-sm text-rose-600" message="Удалить тест вместе с вопросами и результатами студентов?">Удалить тест</ConfirmButton>
              </form>
            </>
          )}
        </section>

        <section className="card border-rose-200 p-6">
          <h2 className="font-semibold text-rose-700">Удалить урок</h2>
          <p className="mt-1 mb-4 text-sm text-slate-600">Прогресс и результаты студентов по этому уроку будут удалены.</p>
          <form action={deleteLesson.bind(null, lesson.id, `/admin/courses/${course.id}`)}>
            <ConfirmButton message={`Удалить урок «${lesson.title}»?`}>Удалить урок</ConfirmButton>
          </form>
        </section>
      </div>
    </>
  );
}
