import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../lib/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaMariaDb(process.env.DATABASE_URL!) });

async function upsertUser(email: string, name: string, password: string, role: "STUDENT" | "ADMIN" | "SUPPORT") {
  return db.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role, passwordHash: await bcrypt.hash(password, 11), emailVerified: new Date() },
  });
}

type LessonSeed = {
  title: string;
  videoUrl?: string;
  durationSec?: number;
  content?: string;
  assignment?: string;
  test?: { q: string; multiple?: boolean; options: [string, boolean][] }[];
};

async function createCourse(data: {
  title: string;
  shortDescription: string;
  description: string;
  objectives: string[];
  teacherName: string;
  access: "OPEN" | "BY_GRANT";
  certificateEnabled: boolean;
  position: number;
  modules: { title: string; lessons: LessonSeed[] }[];
}) {
  const existing = await db.course.findFirst({ where: { title: data.title } });
  if (existing) return existing;
  const course = await db.course.create({
    data: {
      title: data.title,
      shortDescription: data.shortDescription,
      description: data.description,
      objectives: data.objectives.join("\n"),
      teacherName: data.teacherName,
      access: data.access,
      certificateEnabled: data.certificateEnabled,
      published: true,
      position: data.position,
    },
  });
  for (const [mi, m] of data.modules.entries()) {
    const mod = await db.module.create({ data: { courseId: course.id, title: m.title, position: mi } });
    for (const [li, l] of m.lessons.entries()) {
      const lesson = await db.lesson.create({
        data: {
          moduleId: mod.id,
          title: l.title,
          position: li,
          videoUrl: l.videoUrl ?? null,
          durationSec: l.durationSec ?? 0,
          content: l.content ?? null,
          assignment: l.assignment ?? null,
        },
      });
      if (l.test) {
        await db.test.create({
          data: {
            lessonId: lesson.id,
            passingScore: 60,
            maxAttempts: 3,
            questions: {
              create: l.test.map((q, qi) => ({
                text: q.q,
                multiple: Boolean(q.multiple),
                position: qi,
                options: { create: q.options.map(([text, isCorrect], oi) => ({ text, isCorrect, position: oi })) },
              })),
            },
          },
        });
      }
    }
  }
  return course;
}

async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@school.local").toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin12345";
  const admin = await upsertUser(adminEmail, "Администратор", adminPassword, "ADMIN");
  await upsertUser("support@school.local", "Служба поддержки", "support12345", "SUPPORT");
  const student = await upsertUser("student@school.local", "Анна Иванова", "student12345", "STUDENT");

  const web = await createCourse({
    title: "Основы веб-разработки",
    shortDescription: "HTML, CSS и первые шаги в JavaScript: от пустой страницы до готового сайта.",
    description:
      "## О курсе\nКурс для тех, кто хочет понять, как устроены сайты, и сделать свой первый проект.\n\n- Видеоуроки с практикой\n- Тесты после каждого урока\n- Итоговое задание",
    objectives: [
      "Понимать структуру HTML-документа",
      "Верстать адаптивные страницы с помощью CSS",
      "Писать простые скрипты на JavaScript",
      "Публиковать сайт в интернете",
    ],
    teacherName: "Дмитрий Соколов",
    access: "OPEN",
    certificateEnabled: true,
    position: 0,
    modules: [
      {
        title: "Введение",
        lessons: [
          {
            title: "Как устроен интернет",
            videoUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
            durationSec: 635,
            content: "В этом уроке разберём, что происходит, когда вы открываете сайт.\n\n## Ключевые понятия\n- **Браузер** — программа для просмотра страниц\n- **Сервер** — компьютер, который отдаёт страницы\n- **HTTP** — протокол обмена данными",
            test: [
              { q: "Какая программа отображает веб-страницы?", options: [["Браузер", true], ["Компилятор", false], ["Антивирус", false]] },
              { q: "Выберите протоколы передачи веб-страниц", multiple: true, options: [["HTTP", true], ["HTTPS", true], ["FTP-2", false]] },
            ],
          },
          {
            title: "Инструменты разработчика",
            content: "Установите редактор кода (например, VS Code) и современный браузер. Откройте инструменты разработчика клавишей **F12**.",
          },
        ],
      },
      {
        title: "HTML и CSS",
        lessons: [
          {
            title: "Структура HTML-документа",
            videoUrl: "https://www.youtube.com/watch?v=eRsGyueVLvQ",
            durationSec: 888,
            content: "Каждая страница начинается с `<!doctype html>`, затем идут теги `html`, `head` и `body`.",
            test: [
              { q: "Какой тег содержит видимое содержимое страницы?", options: [["<head>", false], ["<body>", true], ["<meta>", false]] },
            ],
          },
          {
            title: "Практика: первая страница",
            content: "Сверстайте страницу-визитку о себе.",
            assignment: "Создайте HTML-страницу с заголовком, фотографией и списком ваших интересов. Пришлите ссылку на код или вставьте его в ответ.",
          },
        ],
      },
    ],
  });

  await createCourse({
    title: "Тайм-менеджмент для студентов",
    shortDescription: "Как планировать учёбу, не выгорать и успевать больше.",
    description: "Практический мини-курс о планировании и продуктивности.",
    objectives: ["Составлять реалистичный план недели", "Расставлять приоритеты", "Бороться с прокрастинацией"],
    teacherName: "Мария Кузнецова",
    access: "BY_GRANT",
    certificateEnabled: false,
    position: 1,
    modules: [
      {
        title: "Планирование",
        lessons: [
          { title: "Матрица Эйзенхауэра", videoUrl: "https://vimeo.com/1084537", durationSec: 597, content: "Разделите задачи на четыре группы по срочности и важности." },
          { title: "Техника Pomodoro", content: "Работайте 25 минут, затем делайте перерыв 5 минут." },
        ],
      },
    ],
  });

  await db.enrollment.upsert({
    where: { userId_courseId: { userId: student.id, courseId: web.id } },
    update: {},
    create: { userId: student.id, courseId: web.id, grantedById: admin.id },
  });

  console.log("Seed completed.");
  console.log(`  Администратор: ${adminEmail} / ${adminPassword}`);
  console.log("  Поддержка:     support@school.local / support12345");
  console.log("  Студент:       student@school.local / student12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
