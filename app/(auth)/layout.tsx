import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-12 sm:py-8">
        <Link href="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-xs text-slate-400">© PrideX</p>
      </div>
      <div className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#0b1633_0%,#15306f_50%,#2456e0_100%)] lg:block">
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,rgba(122,208,253,0.6)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-sky-400/30 blur-3xl" />
        <div className="absolute bottom-10 -left-20 size-80 rounded-full bg-brand-400/35 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="text-3xl leading-tight font-semibold">
            Учитесь в своём темпе —
            <br />
            мы сохраним прогресс за вас.
          </p>
          <ul className="mt-8 space-y-3 text-white/85">
            <li><span className="text-sky-300">▸</span> Видеоуроки, материалы и практические задания</li>
            <li><span className="text-sky-300">▸</span> Тесты с мгновенной проверкой</li>
            <li><span className="text-sky-300">▸</span> Сертификаты по окончании курсов</li>
            <li><span className="text-sky-300">▸</span> Чат с технической поддержкой</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
