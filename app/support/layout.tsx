import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/support", label: "Обращения", icon: "chat", exact: true, primary: true },
  { href: "/support/assignments", label: "Задания на проверку", short: "Задания", icon: "clipboard", primary: true },
  { href: "/learn/settings", label: "Настройки профиля", short: "Профиль", icon: "settings", primary: true },
];

export default function SupportLayout({ children }: LayoutProps<"/support">) {
  return (
    <AppShell nav={nav} homeHref="/support" areaLabel="Поддержка" counters>
      {children}
    </AppShell>
  );
}
