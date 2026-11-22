import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { NotificationList } from "@/components/notification-list";

export const metadata: Metadata = { title: "Уведомления" };

export default async function AdminNotificationsPage() {
  const user = await requireRole("ADMIN");
  return <NotificationList userId={user.id} />;
}
