import { AppShell } from "@/components/app-shell";
import type { NavItem } from "@/components/nav-links";

const nav: NavItem[] = [
  { href: "/support", label: "Обращения", icon: "chat", exact: true },
  { href: "/learn/settings", label: "Настройки профиля", icon: "settings" },
];

export default function SupportLayout({ children }: LayoutProps<"/support">) {
  return (
    <AppShell nav={nav} homeHref="/support" areaLabel="Поддержка">
      {children}
    </AppShell>
  );
}
