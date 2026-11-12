import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { Avatar, Badge, EmptyState, PageHeader, Table } from "@/components/ui";
import { ActionForm, Field, SubmitButton } from "@/components/forms";
import { formatDate, formatDateTime } from "@/lib/format";
import { createUser } from "./actions";
import { roleMeta } from "@/lib/roles";

export const metadata: Metadata = { title: "Пользователи" };

const PAGE = 25;

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const role = typeof sp.role === "string" ? sp.role : "";
  const status = typeof sp.status === "string" ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const showNew = sp.new === "1";

  const where: Prisma.UserWhereInput = {};
  if (q) where.OR = [{ name: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } }, { id: q }];
  if (role === "STUDENT" || role === "ADMIN" || role === "SUPPORT") where.role = role;
  if (status === "blocked") where.blocked = true;
  if (status === "active") where.blocked = false;
  if (status === "unverified") where.emailVerified = null;

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
    }),
    db.user.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const qs = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (role) s.set("role", role);
    if (status) s.set("status", status);
    s.set("page", String(p));
    return `/admin/users?${s}`;
  };

  return (
    <>
      <PageHeader
        title="Пользователи"
        subtitle={`Найдено: ${total}`}
        actions={<Link href={showNew ? "/admin/users" : "/admin/users?new=1"} className="btn-primary">{showNew ? "Скрыть форму" : "Добавить пользователя"}</Link>}
      />

      {showNew && (
        <div className="card mb-6 p-6">
          <h2 className="mb-4 font-semibold text-slate-900">Новый пользователь</h2>
          <ActionForm action={createUser} className="grid gap-4 sm:grid-cols-2">
            <Field label="Имя"><input name="name" required className="input" /></Field>
            <Field label="E-mail"><input name="email" type="email" required className="input" /></Field>
            <Field label="Пароль" hint="Не менее 8 символов, буквы и цифры"><input name="password" required className="input" /></Field>
            <Field label="Роль">
              <select name="role" className="input" defaultValue="STUDENT">
                <option value="STUDENT">Студент</option>
                <option value="SUPPORT">Техподдержка</option>
                <option value="ADMIN">Администратор</option>
              </select>
            </Field>
            <div className="sm:col-span-2"><SubmitButton>Создать</SubmitButton></div>
          </ActionForm>
        </div>
      )}

      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Имя, e-mail, телефон или ID" className="input max-w-xs flex-1" />
        <select name="role" defaultValue={role} className="input w-auto">
          <option value="">Все роли</option>
          <option value="STUDENT">Студенты</option>
          <option value="SUPPORT">Поддержка</option>
          <option value="ADMIN">Администраторы</option>
        </select>
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="">Любой статус</option>
          <option value="active">Активные</option>
          <option value="blocked">Заблокированные</option>
          <option value="unverified">Без подтверждения e-mail</option>
        </select>
        <button className="btn-secondary">Найти</button>
        {(q || role || status) && <Link href="/admin/users" className="btn-ghost">Сбросить</Link>}
      </form>

      {users.length === 0 ? (
        <EmptyState title="Никого не найдено" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Пользователь</th>
              <th>Роль</th>
              <th>Курсы</th>
              <th>Регистрация</th>
              <th>Последний визит</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                    <Avatar name={u.name} size={32} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-900 hover:text-brand-700">{u.name}</span>
                      <span className="block truncate text-xs text-slate-500">{u.email}</span>
                    </span>
                  </Link>
                </td>
                <td><Badge tone={roleMeta[u.role].tone}>{roleMeta[u.role].label}</Badge></td>
                <td className="text-slate-600">{u._count.enrollments}</td>
                <td className="text-slate-500">{formatDate(u.createdAt)}</td>
                <td className="text-slate-500">{formatDateTime(u.lastSeenAt)}</td>
                <td>
                  {u.blocked ? (
                    <Badge tone="red">Заблокирован</Badge>
                  ) : !u.emailVerified ? (
                    <Badge tone="amber">Не подтверждён</Badge>
                  ) : (
                    <Badge tone="green">Активен</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {page > 1 && <Link href={qs(page - 1)} className="btn-secondary btn-sm">← Назад</Link>}
          <span className="text-sm text-slate-500">Страница {page} из {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="btn-secondary btn-sm">Вперёд →</Link>}
        </div>
      )}
    </>
  );
}
