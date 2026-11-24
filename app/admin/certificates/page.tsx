import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge, EmptyState, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { Icon } from "@/components/icons";
import { formatDate, formatDateTime } from "@/lib/format";
import { certificateNames } from "@/lib/certificates";
import { generateCertificate, uploadCertificate } from "./actions";

export const metadata: Metadata = { title: "Сертификаты" };

const tabs = [
  { key: "pending", label: "Ожидают выдачи" },
  { key: "issued", label: "Выданные" },
] as const;

const fileInput =
  "block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700";

export default async function AdminCertificatesPage({ searchParams }: PageProps<"/admin/certificates">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const tab = tabs.find((t) => t.key === sp.tab)?.key ?? "pending";
  const pending = tab === "pending";
  const [items, pendingCount] = await Promise.all([
    db.certificate.findMany({
      where: { issuedAt: pending ? null : { not: null } },
      orderBy: pending ? { createdAt: "asc" } : { issuedAt: "desc" },
      take: 200,
      include: {
        user: { select: { id: true, name: true, email: true } },
        course: { select: { id: true, title: true } },
      },
    }),
    db.certificate.count({ where: { issuedAt: null } }),
  ]);

  return (
    <>
      <PageHeader
        title="Сертификаты"
        subtitle={pendingCount ? `Ожидают выдачи: ${pendingCount}` : "Все сертификаты выданы"}
      />
      <div className="scroll-strip mb-5">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/certificates?tab=${t.key}`}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm whitespace-nowrap ${tab === t.key ? "bg-ink text-white shadow-soft" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
            {t.key === "pending" && pendingCount > 0 && ` (${pendingCount})`}
          </Link>
        ))}
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Здесь пусто"
          text={pending ? "Когда студент завершит курс с сертификатом, он появится здесь." : undefined}
        />
      ) : (
        <div className="space-y-4">
          {items.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/admin/users/${c.user.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                    {c.user.name}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {c.user.email} · <Link href={`/admin/courses/${c.course.id}`} className="link">{c.course.title}</Link>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    № {c.number} · курс завершён {formatDateTime(c.createdAt)}
                    {c.issuedAt && ` · выдан ${formatDate(c.issuedAt)}`}
                  </p>
                </div>
                {c.issuedAt ? <Badge tone="green">Выдан</Badge> : <Badge tone="amber">Ожидает выдачи</Badge>}
              </div>
              {c.fileKey && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`/api/certificates/${c.id}`} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                    <Icon name="file" className="size-4" /> Открыть PDF
                  </a>
                </div>
              )}
              {c.issuedAt && !c.fileKey ? (
                <p className="mt-3 text-xs text-slate-500">Сертификат выдан автоматически (до перехода на PDF). Можно загрузить PDF ниже.</p>
              ) : null}
              {(() => {
                const n = certificateNames(c, c.user.name);
                return (
                  <ActionForm action={generateCertificate.bind(null, c.id)} className="mt-4 flex flex-wrap items-end gap-3">
                    <label className="min-w-52 flex-1">
                      <span className="label">Имя на русской странице</span>
                      <input name="nameRu" defaultValue={n.ru} maxLength={160} className="input" />
                    </label>
                    <label className="min-w-52 flex-1">
                      <span className="label">Имя на английской странице</span>
                      <input name="nameLat" defaultValue={c.nameLat ?? ""} placeholder={n.lat} maxLength={160} className="input" />
                      <span className="hint block">Пусто — транслитерация русского имени</span>
                    </label>
                    <SubmitButton className={c.fileKey ? "btn-secondary" : "btn-primary"} pendingText="Генерируем…">
                      {c.fileKey ? "Перевыпустить" : "Сгенерировать и выдать"}
                    </SubmitButton>
                  </ActionForm>
                );
              })()}
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Загрузить свой PDF вручную</summary>
                <ActionForm action={uploadCertificate.bind(null, c.id)} resetOnSuccess className="mt-3 flex flex-wrap items-end gap-3">
                  <label className="min-w-60 flex-1">
                    <span className="label">{c.fileKey ? "Заменить файл" : "PDF-сертификат"}</span>
                    <input name="file" type="file" accept="application/pdf,.pdf" required className={fileInput} />
                    <span className="hint block">Только PDF, до 20 МБ</span>
                  </label>
                  <SubmitButton className={c.fileKey ? "btn-secondary" : "btn-primary"} pendingText="Загружаем…">
                    {c.fileKey ? "Заменить" : "Загрузить и выдать"}
                  </SubmitButton>
                </ActionForm>
              </details>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
