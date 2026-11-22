import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6 text-center">
      <div>
        <p className="text-6xl font-semibold text-brand-700">404</p>
        <h1 className="mt-3 text-xl font-semibold text-slate-900">Страница не найдена</h1>
        <p className="mt-1 text-sm text-slate-500">Возможно, она была удалена или у вас нет к ней доступа.</p>
        <Link href="/" className="btn-primary mt-6">На главную</Link>
      </div>
    </div>
  );
}
