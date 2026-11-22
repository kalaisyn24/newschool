import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { PrintButton } from "@/components/print-button";
import { Icon } from "@/components/icons";
import { EmptyState } from "@/components/ui";

export default async function CertificatePage({ params }: PageProps<"/learn/certificates/[id]">) {
  const user = await requireLearner();
  const { id } = await params;
  const cert = await db.certificate.findUnique({
    where: { id },
    include: { user: { select: { name: true } }, course: { select: { title: true, teacherName: true } } },
  });
  if (!cert || (cert.userId !== user.id && user.role !== "ADMIN")) notFound();

  const back = <Link href="/learn/certificates" className="text-sm text-slate-500 hover:text-slate-800">← Все сертификаты</Link>;

  // Waiting for the administrator to upload the PDF
  if (!cert.issuedAt) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title="Сертификат готовится"
          text={`Вы завершили курс «${cert.course.title}» ${formatDate(cert.createdAt)}. Администратор загрузит сертификат в ближайшее время — вы получите уведомление.`}
        />
      </div>
    );
  }

  // Uploaded PDF certificate
  if (cert.fileKey) {
    const url = `/api/certificates/${cert.id}`;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {back}
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">Открыть в новой вкладке</a>
            <a href={`${url}?download`} className="btn-primary">
              <Icon name="file" className="size-4" /> Скачать PDF
            </a>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">«{cert.course.title}»</h1>
          <p className="text-sm text-slate-500">№ {cert.number} · выдан {formatDate(cert.issuedAt)}</p>
        </div>
        <iframe src={url} title={`Сертификат ${cert.number}`} className="h-[80vh] w-full rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  // Legacy certificates issued automatically before PDF upload was introduced
  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        {back}
        <PrintButton />
      </div>
      <div className="mx-auto aspect-[1.414] w-full max-w-4xl overflow-hidden rounded-2xl bg-white p-3 shadow-lg print:shadow-none">
        <div className="relative flex h-full flex-col items-center justify-center rounded-xl border-[3px] border-double border-amber-400/70 bg-gradient-to-br from-amber-50/60 via-white to-brand-50/50 px-6 text-center sm:px-16">
          <p className="text-xs font-semibold tracking-[0.35em] text-amber-600 uppercase sm:text-sm">Сертификат</p>
          <p className="mt-1 text-[11px] text-slate-500 sm:text-sm">о прохождении курса</p>
          <p className="mt-6 text-xs text-slate-500 sm:mt-10 sm:text-sm">Настоящим подтверждается, что</p>
          <p className="mt-2 font-serif text-2xl font-semibold text-slate-900 sm:text-5xl">{cert.user.name}</p>
          <p className="mt-4 text-xs text-slate-500 sm:mt-6 sm:text-sm">успешно завершил(а) обучение по курсу</p>
          <p className="mt-2 max-w-2xl text-base font-semibold text-brand-700 sm:text-2xl">«{cert.course.title}»</p>
          <div className="mt-8 flex w-full max-w-2xl justify-between text-left text-[10px] text-slate-500 sm:mt-14 sm:text-sm">
            <div>
              <p className="font-medium text-slate-800">{formatDate(cert.issuedAt)}</p>
              <p>Дата выдачи</p>
            </div>
            {cert.course.teacherName && (
              <div className="text-center">
                <p className="font-medium text-slate-800">{cert.course.teacherName}</p>
                <p>Преподаватель</p>
              </div>
            )}
            <div className="text-right">
              <p className="font-medium text-slate-800">№ {cert.number}</p>
              <p>Регистрационный номер</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
