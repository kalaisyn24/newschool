import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { NotificationList } from "@/components/notification-list";

export const metadata: Metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const user = await requireLearner();
  return <NotificationList userId={user.id} />;
}
