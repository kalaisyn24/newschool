export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M2 9l10-5 10 5-10 5L2 9z" strokeLinejoin="round" />
          <path d="M6 11v5c3 2.5 9 2.5 12 0v-5" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-lg font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        Онлайн-школа
      </span>
    </span>
  );
}
