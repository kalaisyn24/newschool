/**
 * Imports a course exported from GetCourse.
 *
 *   npx tsx scripts/import-getcourse.ts [dir] [--max-mb=50] [--force] [--dry-run]
 *
 * dir (default: import/getcourse) must contain:
 *   gc-course.json   — course structure (modules, lessons, YouTube ids, files)
 *   files/           — downloaded handouts named gc_<hash>.<ext>
 *
 * The course is created unpublished. Files larger than --max-mb or with unsupported
 * extensions are skipped and listed at the end.
 */
import "dotenv/config";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

type GcFile = { name: string; file: string; size: number };
type GcLesson = { gcId: string; title: string; summary: string | null; youtube: string[]; texts: string[]; files: GcFile[] };
type GcCourse = { title: string; modules: { title: string; lessons: GcLesson[] }[] };

const MATERIAL_EXT = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "jpg", "jpeg", "png", "webp", "gif", "mp3"];
const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith("--")) ?? "import/getcourse");
const maxMb = Number(args.find((a) => a.startsWith("--max-mb="))?.split("=")[1] ?? 50);
const force = args.includes("--force");
const dryRun = args.includes("--dry-run");

const COURSE = {
  shortDescription:
    "Курс повысит личную конверсию во взаимодействии с людьми: вы будете понимать истинные мотивы человека и распознавать ложь уже после 5–10 минут общения.",
  description:
    "Курс повысит личную конверсию во взаимодействии с людьми. Вы будете понимать истинные мотивы человека. А не врёт ли он вам? Только после 5–10 минут общения.\n\n" +
    "Вы получите уникальный навык, с помощью которого сможете изменить не только свою жизнь, но и своё окружение. Это мощные инструменты, основанные на научной теоретической базе, которые мы тут же учим применять на практике.\n\n" +
    "После обучения на курсе вы сделаете огромный шаг вперёд в своём развитии и выйдете за рамки прежних стереотипов. Профайлинг можно использовать на всех этапах вашей жизни.",
  objectives: [
    "Психотипы личности и их распознавание",
    "Метапрограммы и мотивация человека",
    "Архетипы",
    "Стимулы в детекции лжи",
    "Распознавание лжи по мимике, жестам и речи",
    "Невербальные коммуникации",
  ].join("\n"),
  teacherName: "Alina Zhogulova",
};

const token = () => randomBytes(9).toString("base64url");
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

async function main() {
  const gc: GcCourse = JSON.parse(await readFile(path.join(dir, "gc-course.json"), "utf8"));
  if (dryRun) return checkOnly(gc);
  const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

  const exists = await db.course.findFirst({ where: { title: gc.title }, select: { id: true } });
  if (exists && !force) {
    console.error(`Курс «${gc.title}» уже есть (id ${exists.id}). Удалите его или запустите с --force.`);
    process.exit(1);
  }

  // The GetCourse welcome video sits outside modules — make it the first lesson of module 1.
  const modules = gc.modules.filter((m) => m.lessons.length > 0);
  if (modules.length > 1 && /^вводн/i.test(modules[0].title)) {
    const [intro, ...rest] = modules;
    rest[0] = { ...rest[0], lessons: [...intro.lessons, ...rest[0].lessons] };
    modules.splice(0, modules.length, ...rest);
  }

  const last = await db.course.findFirst({ orderBy: { position: "desc" }, select: { position: true } });
  const course = await db.course.create({
    data: { title: gc.title, ...COURSE, published: false, sequential: true, position: (last?.position ?? -1) + 1 },
  });
  console.log(`Курс создан: ${course.id}`);

  const month = new Date().toISOString().slice(0, 7);
  const uploadDir = path.join(process.cwd(), "storage", "uploads", "materials", month);
  await mkdir(uploadDir, { recursive: true });
  const skipped: string[] = [];
  const copied = new Map<string, { key: string; size: number }>(); // same file used in several lessons
  let lessons = 0;
  let materials = 0;

  for (const [mi, m] of modules.entries()) {
    const mod = await db.module.create({
      data: { courseId: course.id, title: cut(m.title.replace(/^Модуль\s*\d+\.\s*/i, "").trim(), 200), position: mi },
    });
    for (const [li, l] of m.lessons.entries()) {
      const [main, ...extra] = l.youtube;
      const lesson = await db.lesson.create({
        data: {
          moduleId: mod.id,
          title: cut(l.title.replace(/\.$/, "").trim(), 200),
          summary: l.summary ? cut(l.summary, 500) : null,
          videoUrl: main ? `https://www.youtube.com/watch?v=${main}` : null,
          requireVideo: Boolean(main),
          published: true,
          position: li,
        },
      });
      lessons++;

      for (const [i, id] of extra.entries()) {
        await db.lessonMaterial.create({
          data: { lessonId: lesson.id, title: `Видео ${i + 2}`, externalUrl: `https://www.youtube.com/watch?v=${id}` },
        });
        materials++;
      }

      for (const f of l.files) {
        const ext = path.extname(f.file).slice(1).toLowerCase();
        const src = path.join(dir, "files", `gc_${f.file}`);
        const label = `${f.name} (урок «${l.title}»)`;
        if (!MATERIAL_EXT.includes(ext)) { skipped.push(`${label}: формат .${ext} не поддерживается`); continue; }
        let info = copied.get(f.file);
        if (!info) {
          const st = await stat(src).catch(() => null);
          if (!st) { skipped.push(`${label}: файл не найден ${src}`); continue; }
          if (st.size > maxMb * 1024 * 1024) { skipped.push(`${label}: ${(st.size / 1048576).toFixed(1)} МБ > ${maxMb} МБ`); continue; }
          const key = `materials/${month}/${token()}.${ext}`;
          await copyFile(src, path.join(process.cwd(), "storage", "uploads", key));
          info = { key, size: st.size };
          copied.set(f.file, info);
        }
        await db.lessonMaterial.create({
          data: {
            lessonId: lesson.id,
            title: cut(f.name.replace(/\s*\.[a-z0-9]+$/i, "").trim() || f.name, 200),
            storageKey: info.key,
            mimeType: MIME[ext] ?? "application/octet-stream",
            size: info.size,
          },
        });
        materials++;
      }
    }
  }

  console.log(`Модулей: ${modules.length}, уроков: ${lessons}, материалов: ${materials}, файлов скопировано: ${copied.size}`);
  if (skipped.length) console.log(`\nПропущено (${skipped.length}):\n- ${skipped.join("\n- ")}`);
  console.log(`\nКурс не опубликован. Проверьте его: /admin/courses/${course.id}`);
  await db.$disconnect();
}

/** --dry-run: validates the export without touching the database. */
async function checkOnly(gc: GcCourse) {
  let lessons = 0, videos = 0, files = 0, bytes = 0;
  const problems: string[] = [];
  for (const m of gc.modules) {
    for (const l of m.lessons) {
      lessons++;
      videos += l.youtube.length;
      for (const f of l.files) {
        const ext = path.extname(f.file).slice(1).toLowerCase();
        const st = await stat(path.join(dir, "files", `gc_${f.file}`)).catch(() => null);
        if (!MATERIAL_EXT.includes(ext)) problems.push(`${f.name}: формат .${ext} не поддерживается`);
        else if (!st) problems.push(`${f.name}: файл не найден`);
        else if (st.size > maxMb * 1024 * 1024) problems.push(`${f.name}: ${(st.size / 1048576).toFixed(1)} МБ > ${maxMb} МБ`);
        else { files++; bytes += st.size; }
      }
    }
  }
  console.log(`«${gc.title}»: модулей ${gc.modules.length}, уроков ${lessons}, видео ${videos}, файлов к импорту ${files} (${(bytes / 1048576).toFixed(0)} МБ)`);
  if (problems.length) console.log(`Будет пропущено (${problems.length}):\n- ${problems.join("\n- ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
