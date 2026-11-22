import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/learn", label: "Главная", icon: "home", exact: true, primary: true },
  { href: "/learn/courses", label: "Мои курсы", short: "Курсы", icon: "book", primary: true },
  { href: "/learn/catalog", label: "Каталог", icon: "compass", primary: true },
  { href: "/learn/history", label: "История обучения", icon: "history" },
  { href: "/learn/certificates", label: "Сертификаты", icon: "award" },
  { href: "/learn/notifications", label: "Уведомления", icon: "bell", primary: true },
  { href: "/learn/support", label: "Техподдержка", icon: "chat" },
  { href: "/learn/settings", label: "Настройки", icon: "settings" },
];

export default function LearnLayout({ children }: LayoutProps<"/learn">) {
  return (
    <AppShell nav={nav} homeHref="/learn" counters>
      {children}
    </AppShell>
  );
}
