"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean };

type NavProps = { items: NavItem[]; onNavigate?: () => void };

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
  return <NavList {...props} pathname={pathname} />;
}

function NavList({ items, onNavigate, pathname }: NavProps & { pathname: string }) {
  return (
    <nav className="space-y-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon name={item.icon} className={cx("size-5", active ? "text-brand-600" : "text-slate-400")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile top bar with a slide-out drawer. */
export function MobileNav({ items, header, footer }: { items: NavItem[]; header: ReactNode; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="no-print lg:hidden">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
        {header}
        <button className="btn-ghost px-2.5" onClick={() => setOpen(true)} aria-label="Открыть меню">
          <Icon name="menu" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white p-4 shadow-xl">
            <div className="mb-4">{header}</div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks items={items} onNavigate={() => setOpen(false)} />
            </div>
            {footer && <div className="border-t border-slate-100 pt-3">{footer}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
