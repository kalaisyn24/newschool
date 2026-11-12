import Link from "next/link";
import type { Metadata } from "next";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { EmptyState, PageHeader } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Сертификаты" };

export default async function CertificatesPage() {
  const user = await requireLearner();
  const certs = await db.certificate.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { title: true } } },
  });
  return (
    <>
      <PageHeader title="Сертификаты" subtitle="Документы о прохождении курсов" />
      {certs.length === 0 ? (
        <EmptyState
          title="Сертификатов пока нет"
          text="Сертификат выдаётся автоматически после завершения курса, если это предусмотрено программой."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {certs.map((c) => (
            <Link key={c.id} href={`/learn/certificates/${c.id}`} className="card group p-5 transition hover:border-brand-200 hover:shadow-md">
              <span className="grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600">
                <Icon name="award" className="size-6" />
              </span>
              <p className="mt-4 font-semibold text-slate-900 group-hover:text-brand-700">{c.course.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                № {c.number} · выдан {formatDate(c.issuedAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
