"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import type { ActionState } from "@/lib/action-state";
import { logActivity, notify } from "@/lib/activity";
import { deleteUpload, saveUpload } from "@/lib/storage";
import { issueGeneratedCertificate } from "@/lib/certificates";

const MAX_SIZE = 20 * 1024 * 1024;

/** Admin uploads (or replaces) the PDF certificate; the student is notified. */
export async function uploadCertificate(certId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Выберите PDF-файл сертификата" };
  if (file.size > MAX_SIZE) return { error: "Файл больше 20 МБ" };
  const head = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString("latin1");
  if (head !== "%PDF-") return { error: "Файл не является PDF-документом" };

  const cert = await db.certificate.findUnique({
    where: { id: certId },
    include: { course: { select: { title: true } } },
  });
  if (!cert) return { error: "Сертификат не найден" };

  let saved;
  try {
    saved = await saveUpload(file, "certificates", ["pdf"]);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Не удалось сохранить файл" };
  }
  const firstIssue = !cert.issuedAt;
  await db.certificate.update({
    where: { id: certId },
    data: { fileKey: saved.key, fileSize: saved.size, issuedAt: cert.issuedAt ?? new Date() },
  });
  await deleteUpload(cert.fileKey);

  await notify(
    cert.userId,
    firstIssue ? `Вы получили сертификат: «${cert.course.title}»` : `Сертификат обновлён: «${cert.course.title}»`,
    firstIssue
      ? "Поздравляем! Сертификат о прохождении курса доступен для просмотра и скачивания."
      : "Администратор загрузил новую версию вашего сертификата.",
    `/learn/certificates/${cert.id}`,
  );
  if (firstIssue) await logActivity(cert.userId, "certificate_issued", cert.course.title, `/learn/certificates/${cert.id}`);
  refresh();
  return { ok: true, message: firstIssue ? "Сертификат загружен, студент уведомлён" : "Файл сертификата заменён" };
}

/** Generates the PDF from the template (or re-generates it with corrected names) and issues it. */
export async function generateCertificate(certId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  await requireRole("ADMIN");
  const ru = String(fd.get("nameRu") ?? "").trim();
  const lat = String(fd.get("nameLat") ?? "").trim();
  if (ru.length > 160 || lat.length > 160) return { error: "Имя слишком длинное" };
  try {
    const { firstIssue } = await issueGeneratedCertificate(certId, { ru, lat });
    refresh();
    return { ok: true, message: firstIssue ? "Сертификат сгенерирован и выдан, студент уведомлён" : "Сертификат перевыпущен" };
  } catch (e) {
    console.error("Certificate generation failed", e);
    return { error: e instanceof Error ? `Не удалось сгенерировать: ${e.message}` : "Не удалось сгенерировать сертификат" };
  }
}

/** Deletes the certificate record together with its PDF file. */
export async function deleteCertificate(certId: string) {
  await requireRole("ADMIN");
  const cert = await db.certificate.findUnique({ where: { id: certId }, select: { fileKey: true } });
  if (!cert) return;
  await db.certificate.delete({ where: { id: certId } });
  await deleteUpload(cert.fileKey);
  refresh();
}
