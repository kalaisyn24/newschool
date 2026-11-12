import Link from "next/link";
import type { ReactNode } from "react";
import { initials } from "@/lib/format";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          ← {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const tones = {
  slate: "bg-slate-100 text-slate-700",
  brand: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-rose-50 text-rose-700",
  blue: "bg-sky-50 text-sky-700",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, size = "md", className }: { value: number; size?: "sm" | "md"; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cx("w-full overflow-hidden rounded-full bg-slate-100", size === "sm" ? "h-1.5" : "h-2.5", className)}
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cx("h-full rounded-full transition-all", v === 100 ? "bg-emerald-500" : "bg-brand-600")}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{label}</p>
        {icon && <span className="text-brand-600">{icon}</span>}
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-full bg-brand-50 text-xl text-brand-600">✦</div>
      <p className="font-medium text-slate-900">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-violet-500 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-lg font-semibold text-slate-900">{children}</h2>
      {action}
    </div>
  );
}

export function Alert({ tone = "brand", children }: { tone?: "brand" | "green" | "red" | "amber"; children: ReactNode }) {
  const t = {
    brand: "border-brand-200 bg-brand-50 text-brand-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-rose-200 bg-rose-50 text-rose-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }[tone];
  return <div className={cx("rounded-xl border px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-xl bg-slate-200/70", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function CourseCover({ url, title, className }: { url: string | null; title: string; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cx("w-full object-cover", className)} />;
  }
  const hue = [...title].reduce((s, c) => s + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className={cx("grid w-full place-items-center text-4xl font-bold text-white/90", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 50) % 360} 70% 45%))` }}
      aria-hidden
    >
      {initials(title)}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-xs [&_th]:font-medium [&_th]:tracking-wide [&_th]:text-slate-500 [&_th]:uppercase [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_tbody_tr:hover]:bg-slate-50/60">
        {children}
      </table>
    </div>
  );
}
