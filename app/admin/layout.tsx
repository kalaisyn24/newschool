import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/admin", label: "Обзор", icon: "chart", exact: true },
  { href: "/admin/users", label: "Пользователи", icon: "users" },
  { href: "/admin/courses", label: "Курсы", icon: "book" },
  { href: "/admin/assignments", label: "Задания на проверку", icon: "clipboard" },
  { href: "/support", label: "Техподдержка", icon: "chat" },
  { href: "/learn/settings", label: "Мой профиль", icon: "settings" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AppShell nav={nav} homeHref="/admin" areaLabel="Админ">
      {children}
    </AppShell>
  );
}
