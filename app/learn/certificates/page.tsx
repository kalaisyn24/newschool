import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Сертификаты" };

export default async function CertificatesPage() {
  const user = await requireLearner();
  const certs = await db.certificate.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { course: { select: { title: true } } },
  });
  return (
    <>
      <PageHeader title="Сертификаты" subtitle="Документы о прохождении курсов" />
      {certs.length === 0 ? (
        <EmptyState
          title="Сертификатов пока нет"
          text="После завершения курса с сертификатом администратор подготовит и загрузит ваш сертификат — вы получите уведомление."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => (
            <Link key={c.id} href={`/learn/certificates/${c.id}`} className="card group p-5 transition duration-300 hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-2">
                <span className={`grid size-12 place-items-center rounded-2xl ${c.issuedAt ? "bg-gradient-to-br from-sky-100 to-sky-200 text-sky-700 shadow-soft" : "bg-slate-100 text-slate-400"}`}>
                  <Icon name="award" className="size-6" />
                </span>
                {!c.issuedAt && <Badge tone="amber">Готовится</Badge>}
              </div>
              <p className="mt-4 font-semibold text-slate-900 group-hover:text-brand-700">{c.course.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {c.issuedAt ? `№ ${c.number} · выдан ${formatDate(c.issuedAt)}` : `Курс завершён ${formatDate(c.createdAt)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
