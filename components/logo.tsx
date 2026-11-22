import Image from "next/image";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-slate-200/80">
        <Image src="/logo.png" alt="" width={40} height={40} priority className="size-10" />
      </span>
      <span className={`text-xl font-semibold tracking-tight ${light ? "text-white" : "text-slate-900"}`}>
        PrideX
      </span>
    </span>
  );
}
