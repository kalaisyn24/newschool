import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { Avatar, PageHeader, SectionTitle, StatCard } from "@/components/ui";
import { Icon } from "@/components/icons";
import { formatDateTime } from "@/lib/format";
import { activityLabel } from "@/lib/activity-labels";

export const metadata: Metadata = { title: "Администрирование" };

function daysAgo(days: number) {
  return new Date(Date.now() - days * 864e5);
}

export default async function AdminHome() {
  await requireRole("ADMIN");
  const weekAgo = daysAgo(7);
  const [students, newStudents, courses, published, enrollments, completed, openChats, pendingSubs, pendingCerts, pendingCards, recentUsers, recentActivity] =
    await Promise.all([
      db.user.count({ where: { role: "STUDENT" } }),
      db.user.count({ where: { role: "STUDENT", createdAt: { gte: weekAgo } } }),
      db.course.count(),
      db.course.count({ where: { published: true } }),
      db.enrollment.count({ where: { status: "ACTIVE" } }),
      db.enrollment.count({ where: { completedAt: { not: null } } }),
      db.conversation.count({ where: { status: "OPEN", unreadByStaff: true } }),
      db.assignmentSubmission.count({ where: { status: "SUBMITTED" } }),
      db.certificate.count({ where: { issuedAt: null } }),
      db.profilerCard.count({ where: { issuedAt: null } }),
      db.user.findMany({ orderBy: { createdAt: "desc" }, take: 6, select: { id: true, name: true, email: true, createdAt: true } }),
      db.activityLog.findMany({
        where: { action: { not: "login" } },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

  return (
    <>
      <PageHeader
        title="Обзор платформы"
        actions={
          <>
            <Link href="/admin/courses/new" className="btn-primary"><Icon name="plus" className="size-4" /> Новый курс</Link>
            <Link href="/admin/users?new=1" className="btn-secondary">Добавить пользователя</Link>
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Студентов" value={students} hint={`+${newStudents} за неделю`} icon={<Icon name="users" />} />
        <StatCard label="Курсов" value={courses} hint={`опубликовано: ${published}`} icon={<Icon name="book" />} />
        <StatCard label="Активных доступов" value={enrollments} hint={`завершений курсов: ${completed}`} icon={<Icon name="chart" />} />
        <StatCard
          label="Требуют внимания"
          value={openChats + pendingSubs + pendingCerts + pendingCards}
          hint={
            <span className="flex flex-wrap gap-x-3">
              <Link href="/support" className="link-plain">чатов: {openChats}</Link>
              <Link href="/admin/assignments" className="link-plain">заданий: {pendingSubs}</Link>
              <Link href="/admin/certificates" className="link-plain">сертификатов: {pendingCerts}</Link>
              <Link href="/admin/profiler-cards" className="link-plain">удостоверений: {pendingCards}</Link>
            </span>
          }
          icon={<Icon name="bell" />}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle action={<Link href="/admin/users" className="text-sm link">Все</Link>}>Новые пользователи</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {recentUsers.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center gap-3 p-3.5 hover:bg-slate-50">
                <Avatar name={u.name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <span className="text-xs text-slate-400">{formatDateTime(u.createdAt)}</span>
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle>Последняя активность</SectionTitle>
          <div className="card divide-y divide-slate-100">
            {recentActivity.length === 0 && <p className="p-4 text-sm text-slate-500">Пока пусто</p>}
            {recentActivity.map((a) => (
              <div key={a.id} className="p-3.5 text-sm">
                <Link href={`/admin/users/${a.user.id}`} className="font-medium text-slate-900 hover:text-brand-700">{a.user.name}</Link>
                <span className="text-slate-600"> — {activityLabel(a.action).toLowerCase()}</span>
                {a.details && <span className="text-slate-500">: {a.details}</span>}
                <p className="text-xs text-slate-400">{formatDateTime(a.createdAt)}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
