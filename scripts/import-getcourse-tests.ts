/**
 * Adds GetCourse tests and assignments to a course that was imported with import-getcourse.ts.
 *
 *   npx tsx scripts/import-getcourse-tests.ts [dir] [--course=<id>] [--final] [--force] [--dry-run]
 *
 * dir (default: import/getcourse) must contain:
 *   gc-course.json      — the course export (used to find lessons by their GetCourse id)
 *   gc-tests.json       — tests: [{ gcTestId, title, lessonGcId, questions: [{ text, type, options: [{ text, ok }] }] }]
 *   gc-assignments.json — optional: [{ lessonGcId, text }] (text is Markdown); the assignment becomes required
 *
 * Lessons are matched by title. --course picks the course by id (default: newest course with the export's title).
 *
 * Tests with lessonGcId are attached to that lesson. Lessons that already have a test are
 * skipped unless --force (which replaces the test and drops its attempts).
 * --final also adds the module summary tests (lessonGcId = null) as a separate lesson
 * "Итоговый тест" at the end of their module.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

type GcOption = { text: string; ok: boolean };
type GcQuestion = { text: string; description?: string; type: string; options: GcOption[] };
type GcTest = { gcTestId: number; title: string; lessonGcId: string | null; questions: GcQuestion[] };
type GcAssignment = { lessonGcId: string; text: string };
type GcCourse = { title: string; modules: { title: string; lessons: { gcId: string; title: string }[] }[] };

// Module summary tests on GetCourse are not attached to lessons: GetCourse test id → module position (0-based).
const FINAL_TESTS: Record<number, number> = {
  6823105: 0, // Тестирование Психотипы
  6981651: 1, // Метапрограмма
  7333409: 2, // Тестирование Архетипы
  8738797: 3, // Тестирование Стимулы
  8739341: 4, // Тестирование 5 модуль
};

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "import/getcourse");
const withFinal = args.includes("--final");
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");
const courseId = args.find((a) => a.startsWith("--course="))?.split("=")[1];

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
// Same title normalisation as import-getcourse.ts
const lessonTitle = (s: string) => cut(s.replace(/\.$/, "").trim(), 200);

function questionData(q: GcQuestion, position: number) {
  const right = q.options.filter((o) => o.ok).length;
  const text = clean(q.description ? `${q.text}\n${q.description}` : q.text);
  return {
    text,
    // GetCourse "multiple_choice" may still have a single right answer — keep it as multiple choice
    // so students are not hinted how many options are correct.
    multiple: q.type === "multiple_choice" || right > 1,
    position,
    options: { create: q.options.map((o, i) => ({ text: cut(clean(o.text), 500), isCorrect: o.ok, position: i })) },
  };
}

function validate(t: GcTest): string[] {
  const p: string[] = [];
  t.questions.forEach((q, i) => {
    if (!q.options.length) p.push(`«${t.title}», вопрос ${i + 1}: нет вариантов`);
    else if (!q.options.some((o) => o.ok)) p.push(`«${t.title}», вопрос ${i + 1}: нет правильного ответа`);
    if (!["select_one", "multiple_choice"].includes(q.type)) p.push(`«${t.title}», вопрос ${i + 1}: тип ${q.type} не поддерживается`);
  });
  return p;
}

async function main() {
  const gc: GcCourse = JSON.parse(await readFile(path.join(dir, "gc-course.json"), "utf8"));
  const tests: GcTest[] = JSON.parse(await readFile(path.join(dir, "gc-tests.json"), "utf8"));
  const assignments: GcAssignment[] = JSON.parse(
    await readFile(path.join(dir, "gc-assignments.json"), "utf8").catch(() => "[]"),
  );
  const gcLessons = new Map(gc.modules.flatMap((m) => m.lessons).map((l) => [l.gcId, l.title]));

  const problems = tests.flatMap(validate);
  const lessonTests = tests.filter((t) => t.lessonGcId);
  const finals = tests.filter((t) => !t.lessonGcId && t.gcTestId in FINAL_TESTS);
  const unknown = tests.filter((t) => !t.lessonGcId && !(t.gcTestId in FINAL_TESTS));
  for (const t of lessonTests) if (!gcLessons.has(t.lessonGcId!)) problems.push(`«${t.title}»: урок ${t.lessonGcId} не найден в gc-course.json`);
  for (const a of assignments) if (!gcLessons.has(a.lessonGcId)) problems.push(`Задание: урок ${a.lessonGcId} не найден в gc-course.json`);
  for (const t of unknown) problems.push(`«${t.title}» (${t.gcTestId}): не привязан к уроку — пропущен`);

  const qCount = (ts: GcTest[]) => ts.reduce((n, t) => n + t.questions.length, 0);
  console.log(`Тестов к урокам: ${lessonTests.length} (${qCount(lessonTests)} вопросов)`);
  console.log(`Итоговых тестов по модулям: ${finals.length} (${qCount(finals)} вопросов)${withFinal ? "" : " — пропущены, добавьте --final"}`);
  console.log(`Заданий: ${assignments.length}`);
  if (problems.length) console.log(`\nЗамечания (${problems.length}):\n- ${problems.join("\n- ")}`);
  if (dryRun) return;

  const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });
  const course = await db.course.findFirst({
    where: courseId ? { id: courseId } : { title: gc.title },
    orderBy: { createdAt: "desc" },
    include: { modules: { orderBy: { position: "asc" }, include: { lessons: { orderBy: { position: "asc" }, include: { test: { select: { id: true } } } } } } },
  });
  if (!course) throw new Error(`Курс ${courseId ?? `«${gc.title}»`} не найден. Сначала запустите import-getcourse.ts`);
  console.log(`\nКурс: «${course.title}» (${course.id})`);
  const lessons = course.modules.flatMap((m) => m.lessons);

  let added = 0, replaced = 0, skipped = 0;
  const missing: string[] = [];

  async function attach(lessonId: string, hasTest: boolean, t: GcTest) {
    if (hasTest && !force) { skipped++; return; }
    if (hasTest) { await db.test.deleteMany({ where: { lessonId } }); replaced++; } else added++;
    await db.test.create({
      data: {
        lessonId,
        passingScore: 70,
        required: true,
        showAnswers: true,
        questions: { create: t.questions.map(questionData) },
      },
    });
  }

  const findLesson = (gcId: string) => {
    const title = lessonTitle(gcLessons.get(gcId) ?? "");
    const matches = lessons.filter((l) => l.title === title);
    if (matches.length !== 1) missing.push(`урок «${title}»: найдено ${matches.length}`);
    return matches.length === 1 ? matches[0] : null;
  };

  for (const t of lessonTests) {
    const lesson = findLesson(t.lessonGcId!);
    if (lesson) await attach(lesson.id, Boolean(lesson.test), t);
  }

  let assigned = 0, assignSkipped = 0;
  for (const a of assignments) {
    const lesson = findLesson(a.lessonGcId);
    if (!lesson) continue;
    if (lesson.assignment && !force) { assignSkipped++; continue; }
    await db.lesson.update({ where: { id: lesson.id }, data: { assignment: a.text, requireAssignment: true } });
    assigned++;
  }

  if (withFinal) {
    for (const t of finals) {
      const mod = course.modules[FINAL_TESTS[t.gcTestId]];
      if (!mod) { missing.push(`«${t.title}»: модуль ${FINAL_TESTS[t.gcTestId] + 1} не найден`); continue; }
      const title = "Итоговый тест по модулю";
      let lesson = mod.lessons.find((l) => l.title === title);
      if (!lesson) {
        const created = await db.lesson.create({
          data: {
            moduleId: mod.id,
            title,
            summary: `Проверьте, как вы усвоили модуль «${mod.title}».`,
            requireVideo: false,
            published: true,
            position: (mod.lessons.at(-1)?.position ?? -1) + 1,
          },
        });
        lesson = { ...created, test: null };
      }
      await attach(lesson.id, Boolean(lesson.test), t);
    }
  }

  console.log(`\nДобавлено тестов: ${added}, заменено: ${replaced}, пропущено (уже есть тест): ${skipped}`);
  console.log(`Заданий добавлено: ${assigned}, пропущено (уже есть): ${assignSkipped}`);
  if (skipped || assignSkipped) console.log("Чтобы заменить существующие тесты и задания, запустите с --force.");
  if (missing.length) console.log(`\nНе удалось привязать (${missing.length}):\n- ${missing.join("\n- ")}`);
  console.log(`\nПроверьте курс: /admin/courses/${course.id}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
