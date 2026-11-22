import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AssignmentReview } from "@/components/assignment-review";

export const metadata: Metadata = { title: "Задания на проверку" };

export default async function SupportAssignmentsPage({ searchParams }: PageProps<"/support/assignments">) {
  const user = await requireRole("ADMIN", "SUPPORT");
  const sp = await searchParams;
  return <AssignmentReview basePath="/support/assignments" statusParam={sp.status} adminLinks={user.role === "ADMIN"} />;
}
