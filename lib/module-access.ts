import "server-only";
import { db } from "@/lib/db";
import { notify } from "@/lib/activity";

/** Which modules of a course an enrollment opens. */
export type ModuleSelection = { allModules: true } | { allModules: false; moduleIds: string[] };

/**
 * Reads the module picker fields from a form:
 *   modulesMode = "all" | "some", moduleId = <id> (repeated).
 * Only modules of the given course are accepted; "some" needs at least one module.
 */
export async function readModuleSelection(fd: FormData, courseId: string): Promise<ModuleSelection | { error: string }> {
  if (fd.get("modulesMode") !== "some") return { allModules: true };
  const picked = new Set(fd.getAll("moduleId").filter((v): v is string => typeof v === "string"));
  const modules = await db.module.findMany({ where: { courseId }, select: { id: true } });
  const moduleIds = modules.map((m) => m.id).filter((id) => picked.has(id));
  if (!moduleIds.length) return { error: "Отметьте хотя бы один модуль" };
  // every module ticked = full access (future modules open too)
  if (moduleIds.length === modules.length) return { allModules: true };
  return { allModules: false, moduleIds };
}

/**
 * Applies a module selection to an enrollment. Notifies the student about newly opened modules
 * (pass notifyStudent = false when a "course opened" notification is sent anyway).
 */
export async function applyModuleSelection(enrollmentId: string, sel: ModuleSelection, notifyStudent = true) {
  const before = await db.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    select: {
      userId: true,
      courseId: true,
      allModules: true,
      modules: { select: { moduleId: true } },
      course: { select: { title: true, modules: { orderBy: { position: "asc" }, select: { id: true, title: true } } } },
    },
  });
  const wasOpen = new Set(before.allModules ? before.course.modules.map((m) => m.id) : before.modules.map((m) => m.moduleId));

  await db.$transaction([
    db.enrollmentModule.deleteMany({ where: { enrollmentId } }),
    db.enrollment.update({ where: { id: enrollmentId }, data: { allModules: sel.allModules } }),
    ...(sel.allModules
      ? []
      : [db.enrollmentModule.createMany({ data: sel.moduleIds.map((moduleId) => ({ enrollmentId, moduleId })) })]),
  ]);

  const nowOpen = sel.allModules ? before.course.modules.map((m) => m.id) : sel.moduleIds;
  const added = before.course.modules.filter((m) => nowOpen.includes(m.id) && !wasOpen.has(m.id));
  if (notifyStudent && added.length) {
    await notify(
      before.userId,
      added.length === 1
        ? `Вам открыт модуль «${added[0].title}»`
        : `Вам открыты новые модули курса «${before.course.title}»`,
      added.length === 1 ? undefined : added.map((m) => `«${m.title}»`).join(", "),
      `/learn/courses/${before.courseId}`,
    );
  }
}

/** Short label of an enrollment's module access, e.g. "Все модули" or "2 из 6". */
export function moduleAccessLabel(e: { allModules: boolean; modules: unknown[] }, totalModules: number) {
  return e.allModules ? "Все модули" : `Модули: ${e.modules.length} из ${totalModules}`;
}
