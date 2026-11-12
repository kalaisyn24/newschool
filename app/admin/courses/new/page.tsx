import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CourseForm } from "@/components/admin/course-form";
import { createCourse } from "../actions";

export const metadata: Metadata = { title: "Новый курс" };

export default async function NewCoursePage() {
  await requireRole("ADMIN");
  return (
    <>
      <PageHeader back={{ href: "/admin/courses", label: "Курсы" }} title="Новый курс" subtitle="После создания можно добавить модули и уроки" />
      <div className="card p-6">
        <CourseForm action={createCourse} submitLabel="Создать курс" />
      </div>
    </>
  );
}
