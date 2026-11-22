import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AssignmentReview } from "@/components/assignment-review";

export const metadata: Metadata = { title: "Задания на проверку" };

export default async function AssignmentsPage({ searchParams }: PageProps<"/admin/assignments">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  return <AssignmentReview basePath="/admin/assignments" statusParam={sp.status} adminLinks />;
}
