"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "@/components/ui";
import { CountBadge, useNavCounters } from "@/components/nav-counters";

/**
 * `primary` items also appear in the bottom tab bar on phones (up to 4);
 * `short` is the label used there when the full one is too long.
 */
export type NavItem = { href: string; label: string; short?: string; icon: IconName; exact?: boolean; primary?: boolean };

type NavProps = { items: NavItem[]; onNavigate?: () => void };

function isActive(item: NavItem, pathname: string) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/** The pathname is request data, so the highlighted list streams in behind Suspense. */
export function NavLinks(props: NavProps) {
  return (
    <Suspense fallback={<NavList {...props} pathname="" />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavProps) {
  const pathname = usePathname();
  const { refresh } = useNavCounters();
  // Re-check the badges on every page change (e.g. after opening a support request)
  useEffect(() => {
    refresh();
  }, [pathname, refresh]);
  return <NavList {...props} pathname={pathname} />;
}

function NavList({ items, onNavigate, pathname }: NavProps & { pathname: string }) {
  const { counts } = useNavCounters();
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cx(
              "relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active ? "bg-[linear-gradient(155deg,oklch(97.5%_.006_85)_0%,rgb(234,242,242)_60%,rgba(220,233,235,0)_100%)] font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]" : "text-slate-700 hover:bg-white hover:text-ink hover:shadow-soft",
            )}
          >
            {active && <span className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-gradient-to-b from-[#7f9ca0] to-[#9fb7ba]" aria-hidden />}
            <Icon name={item.icon} className={cx("size-5", active ? "text-ink" : "text-slate-500")} />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <CountBadge value={counts[item.href]} />
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Phones and tablets: a compact top bar plus a bottom tab bar with the main sections
 * and a "Ещё" button that opens a sheet with the full menu and the profile box.
 */
export function MobileNav({ items, header, footer }: { items: NavItem[]; header: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);

  // Lock page scroll and allow closing with Escape while the sheet is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="no-print lg:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/60 bg-white/70 px-4 shadow-soft backdrop-blur-md pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        {header}
      </div>

      <Suspense fallback={<TabBar items={items} pathname="" onMore={() => setOpen(true)} moreOpen={open} />}>
        <ActiveTabBar items={items} onMore={() => setOpen(true)} moreOpen={open} />
      </Suspense>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Меню">
          <button className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-label="Закрыть меню" />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-3xl bg-gradient-to-b from-white to-slate-50 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(31,36,38,0.15)]">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" aria-hidden />
            <div className="mb-3 flex items-center justify-between">
              {header}
              <button className="btn-ghost px-3" onClick={() => setOpen(false)} aria-label="Закрыть меню">✕</button>
            </div>
            <div className="-mx-1 flex-1 overflow-y-auto px-1">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
            {footer && <div className="mt-3 border-t border-slate-100 pt-3">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

type TabBarProps = { items: NavItem[]; onMore: () => void; moreOpen: boolean };

function ActiveTabBar(props: TabBarProps) {
  const pathname = usePathname();
  return <TabBar {...props} pathname={pathname} />;
}

function TabBar({ items, pathname, onMore, moreOpen }: TabBarProps & { pathname: string }) {
  const { counts } = useNavCounters();
  const tabs = items.filter((i) => i.primary).slice(0, 4);
  const rest = items.filter((i) => !tabs.includes(i));
  const restCount = rest.reduce((s, i) => s + (counts[i.href] ?? 0), 0);
  const restActive = rest.some((i) => isActive(i, pathname));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/70 bg-white/85 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_24px_-12px_rgba(31,36,38,0.18)] backdrop-blur-xl"
      aria-label="Основные разделы"
    >
      <div className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((item) => (
          <TabButton
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.short ?? item.label}
            active={isActive(item, pathname)}
            count={counts[item.href]}
          />
        ))}
        <TabButton icon="menu" label="Ещё" active={moreOpen || restActive} count={restCount} onClick={onMore} />
      </div>
    </nav>
  );
}

function TabButton({
  href,
  icon,
  label,
  active,
  count,
  onClick,
}: {
  href?: string;
  icon: IconName;
  label: string;
  active: boolean;
  count?: number;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span
        className={cx(
          "relative grid h-8 w-14 place-items-center rounded-full transition-colors",
          active ? "bg-gradient-to-br from-brand-300 to-brand-500 text-ink shadow-glow" : "text-slate-500",
        )}
      >
        <Icon name={icon} className="size-5" />
        <CountBadge value={count} className="absolute -top-1 right-0.5 h-4 min-w-4 px-1 text-[10px]" />
      </span>
      <span className={cx("max-w-full truncate px-1 text-[11px] leading-tight", active ? "font-semibold text-ink" : "text-slate-600")}>
        {label}
      </span>
    </>
  );
  const cls = "flex min-h-14 flex-col items-center justify-center gap-0.5 py-1.5";
  if (href) {
    return (
      <Link href={href} className={cls} aria-current={active ? "page" : undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-expanded={active}>
      {content}
    </button>
  );
}
