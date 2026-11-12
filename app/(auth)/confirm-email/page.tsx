import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Alert, Skeleton } from "@/components/ui";
import { db } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { logActivity } from "@/lib/activity";

export const metadata: Metadata = { title: "Смена e-mail" };

export default function ConfirmEmailPage({ searchParams }: PageProps<"/confirm-email">) {
  return (
    <Suspense fallback={<Skeleton className="h-40" />}>
      <Confirm searchParams={searchParams} />
    </Suspense>
  );
}

async function Confirm({ searchParams }: { searchParams: PageProps<"/confirm-email">["searchParams"] }) {
  const sp = await searchParams;
  const raw = typeof sp.token === "string" ? sp.token : "";
  const token = await consumeToken(raw, "CHANGE_EMAIL");
  let error: string | null = null;
  if (!token?.newEmail) {
    error = "Ссылка недействительна или срок её действия истёк.";
  } else {
    const taken = await db.user.findUnique({ where: { email: token.newEmail }, select: { id: true } });
    if (taken && taken.id !== token.userId) {
      error = "Этот e-mail уже используется другим аккаунтом.";
    } else {
      await db.user.update({
        where: { id: token.userId },
        data: { email: token.newEmail, emailVerified: new Date() },
      });
      await logActivity(token.userId, "email_changed", token.newEmail);
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{error ? "Не удалось сменить e-mail" : "E-mail изменён"}</h1>
      {error ? (
        <Alert tone="red">{error}</Alert>
      ) : (
        <Alert tone="green">Новый адрес {token!.newEmail} подтверждён и теперь используется для входа.</Alert>
      )}
      <Link href="/learn/settings" className="btn-primary w-full">
        Перейти в настройки
      </Link>
    </div>
  );
}
