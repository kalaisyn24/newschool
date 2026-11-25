import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Удостоверение профайлера" };

export default async function ProfilerCardPage() {
  const user = await requireLearner();
  const cards = await db.profilerCard.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true } } },
  });

  return (
    <>
      <PageHeader title="Удостоверение профайлера" subtitle="Документ, подтверждающий квалификацию профайлера" />
      {cards.length === 0 ? (
        <EmptyState
          title="Удостоверения пока нет"
          text="После завершения курса администратор подготовит и загрузит ваше удостоверение профайлера — вы получите уведомление."
        />
      ) : (
        <div className="space-y-8">
          {cards.map((c) => {
            if (!c.issuedAt || !c.fileKey)
              return (
                <EmptyState
                  key={c.id}
                  title="Удостоверение готовится"
                  text={`Вы завершили курс «${c.course.title}». Администратор загрузит удостоверение профайлера в ближайшее время — вы получите уведомление.`}
                />
              );
            const url = `/api/profiler-cards/${c.id}`;
            return (
              <section key={c.id} className="space-y-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">«{c.course.title}»</h2>
                    <p className="text-sm text-slate-500">Выдано {formatDate(c.issuedAt)}</p>
                  </div>
                  <div className="flex gap-2">
                    <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">Открыть в новой вкладке</a>
                    <a href={`${url}?download`} className="btn-primary">
                      <Icon name="file" className="size-4" /> Скачать PDF
                    </a>
                  </div>
                </div>
                <iframe src={url} title="Удостоверение профайлера" className="h-[80vh] w-full rounded-2xl border border-slate-200 bg-white" />
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
