import Link from "next/link";
import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
        <p className="text-xs text-slate-400">© Онлайн-школа</p>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-600 via-indigo-600 to-violet-600 lg:block">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <p className="text-3xl leading-tight font-semibold">
            Учитесь в своём темпе —
            <br />
            мы сохраним прогресс за вас.
          </p>
          <ul className="mt-8 space-y-3 text-white/85">
            <li>▸ Видеоуроки, материалы и практические задания</li>
            <li>▸ Тесты с мгновенной проверкой</li>
            <li>▸ Сертификаты по окончании курсов</li>
            <li>▸ Чат с технической поддержкой</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
