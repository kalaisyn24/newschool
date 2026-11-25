import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/admin", label: "Обзор", icon: "chart", exact: true, primary: true },
  { href: "/admin/users", label: "Пользователи", short: "Люди", icon: "users" },
  { href: "/admin/courses", label: "Курсы", icon: "book", primary: true },
  { href: "/admin/assignments", label: "Задания на проверку", short: "Задания", icon: "clipboard", primary: true },
  { href: "/admin/certificates", label: "Сертификаты", icon: "award" },
  { href: "/admin/profiler-cards", label: "Удостоверения профайлера", short: "Удостоверения", icon: "idcard" },
  { href: "/admin/notifications", label: "Уведомления", icon: "bell" },
  { href: "/support", label: "Техподдержка", short: "Чаты", icon: "chat", primary: true },
  { href: "/learn/settings", label: "Мой профиль", icon: "settings" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell nav={nav} homeHref="/admin" areaLabel="Админ" counters>
      {children}
    </AppShell>
  );
}
