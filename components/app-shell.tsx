import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileNav, NavLinks, type NavItem } from "@/components/nav-links";
import { Avatar, Skeleton } from "@/components/ui";
import { Icon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";

const roleLabel = { STUDENT: "Студент", ADMIN: "Администратор", SUPPORT: "Техподдержка" } as const;

export function AppShell({
  nav,
  areaLabel,
  homeHref,
  children,
}: {
  nav: NavItem[];
  areaLabel?: string;
  homeHref: string;
  children: ReactNode;
}) {
  const brand = (
    <Link href={homeHref} className="flex items-center gap-2">
      <Logo />
      {areaLabel && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 uppercase">{areaLabel}</span>}
    </Link>
  );
  const userBox = (
    <Suspense fallback={<Skeleton className="h-12" />}>
      <UserBox />
    </Suspense>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="mb-6 px-1">{brand}</div>
        <div className="flex-1 overflow-y-auto">
          <NavLinks items={nav} />
        </div>
        <div className="border-t border-slate-100 pt-3">{userBox}</div>
      </aside>
      <MobileNav items={nav} header={brand} footer={userBox} />
      <main className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

async function UserBox() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{roleLabel[user.role]}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {user.role === "ADMIN" && (
          <>
            <Link href="/admin" className="btn-ghost btn-sm">Админка</Link>
            <Link href="/support" className="btn-ghost btn-sm">Поддержка</Link>
            <Link href="/learn" className="btn-ghost btn-sm">Обучение</Link>
          </>
        )}
        {user.role === "SUPPORT" && (
          <Link href="/support" className="btn-ghost btn-sm">Поддержка</Link>
        )}
        <form action={logout}>
          <button className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">
            <Icon name="logout" className="size-4" /> Выйти
          </button>
        </form>
      </div>
    </div>
  );
}
