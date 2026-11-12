"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Что-то пошло не так</h1>
        <p className="mt-1 text-sm text-slate-500">Попробуйте обновить страницу. Если ошибка повторяется — напишите в поддержку.</p>
        {error.digest && <p className="mt-2 font-mono text-xs text-slate-400">Код: {error.digest}</p>}
        <button className="btn-primary mt-6" onClick={reset}>Повторить</button>
      </div>
    </div>
  );
}
