import type { ActionState } from "@/lib/action-state";
import { ActionForm, Field, SubmitButton, Toggle } from "@/components/forms";
import { CourseCover } from "@/components/ui";

type CourseValues = {
  title: string;
  shortDescription: string;
  description: string;
  objectives: string;
  coverUrl: string | null;
  teacherName: string | null;
  teacherBio: string | null;
  published: boolean;
  access: "OPEN" | "BY_GRANT";
  sequential: boolean;
  certificateEnabled: boolean;
  profilerCardEnabled: boolean;
  position: number;
};

export function CourseForm({
  action,
  course,
  submitLabel,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  course?: CourseValues;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <Field label="Название курса">
            <input name="title" defaultValue={course?.title} required className="input" />
          </Field>
          <Field label="Краткое описание" hint="Показывается в карточке курса (до 500 символов)">
            <textarea name="shortDescription" defaultValue={course?.shortDescription} rows={2} required maxLength={500} className="input" />
          </Field>
          <Field label="Подробное описание" hint="Поддерживается простая разметка: ## заголовок, - список, **жирный**, [ссылка](https://…)">
            <textarea name="description" defaultValue={course?.description} rows={8} className="input" />
          </Field>
          <Field label="Цели и результаты обучения" hint="Каждый пункт — с новой строки">
            <textarea name="objectives" defaultValue={course?.objectives} rows={5} className="input" placeholder={"Научитесь…\nСможете…"} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Преподаватель">
              <input name="teacherName" defaultValue={course?.teacherName ?? ""} className="input" placeholder="Имя и фамилия" />
            </Field>
            <Field label="Порядок в каталоге" hint="Меньше — выше">
              <input name="position" type="number" defaultValue={course?.position ?? 0} className="input" />
            </Field>
          </div>
          <Field label="О преподавателе">
            <textarea name="teacherBio" defaultValue={course?.teacherBio ?? ""} rows={3} className="input" />
          </Field>
        </div>
        <div className="space-y-4">
          <div>
            <span className="label">Обложка</span>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <CourseCover url={course?.coverUrl ?? null} title={course?.title || "Курс"} className="aspect-video" />
            </div>
            <input name="cover" type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700" />
            <p className="hint">JPG, PNG, WEBP до 5 МБ, лучше 16:9</p>
            {course?.coverUrl && (
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="removeCover" className="size-4 accent-brand-600" /> Удалить обложку
              </label>
            )}
          </div>
          {course && (
            <div className="space-y-2">
              <Toggle name="published" defaultChecked={course.published} label="Опубликован" hint="Курс виден студентам" />
              <Toggle name="sequential" defaultChecked={course.sequential} label="Последовательное прохождение" hint="Следующий урок открывается после выполнения условий предыдущего" />
              <Toggle name="certificateEnabled" defaultChecked={course.certificateEnabled} label="Выдавать сертификат" hint="После завершения всех уроков администратор получит уведомление и загрузит PDF" />
              <Toggle name="profilerCardEnabled" defaultChecked={course.profilerCardEnabled} label="Выдавать удостоверение профайлера" hint="После завершения курса администратор получит уведомление и загрузит PDF удостоверения" />
              <Field label="Доступ к курсу">
                <select name="access" defaultValue={course.access} className="input">
                  <option value="BY_GRANT">Только по доступу от администратора</option>
                  <option value="OPEN">Свободная запись из каталога</option>
                </select>
              </Field>
            </div>
          )}
        </div>
      </div>
      <SubmitButton pendingText="Сохраняем…">{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
