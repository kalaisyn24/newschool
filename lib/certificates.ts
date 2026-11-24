import "server-only";
import { db } from "@/lib/db";
import { logActivity, notify } from "@/lib/activity";
import { generateCertificatePdf } from "@/lib/certificate-pdf";
import { deleteUpload, saveBuffer } from "@/lib/storage";
import { transliterate } from "@/lib/translit";

/** Names that will be printed on the certificate: saved overrides, otherwise the profile name. */
export function certificateNames(cert: { nameRu: string | null; nameLat: string | null }, profileName: string) {
  const ru = cert.nameRu?.trim() || profileName.trim();
  const lat = cert.nameLat?.trim() || transliterate(ru);
  return { ru, lat };
}

/**
 * Generates the PDF for a certificate from the template, stores it and issues it to the student
 * (with a notification). Re-running it replaces the file, e.g. after the name was corrected.
 */
export async function issueGeneratedCertificate(certId: string, override?: { ru?: string; lat?: string }) {
  const cert = await db.certificate.findUniqueOrThrow({
    where: { id: certId },
    include: { user: { select: { name: true } }, course: { select: { title: true } } },
  });
  const nameRu = override?.ru?.trim() || cert.nameRu;
  const nameLat = override?.lat?.trim() || (override?.ru?.trim() ? null : cert.nameLat);
  const names = certificateNames({ nameRu, nameLat }, cert.user.name);

  const pdf = await generateCertificatePdf(names);
  const saved = await saveBuffer(pdf, "certificates", "pdf");
  const firstIssue = !cert.issuedAt;
  await db.certificate.update({
    where: { id: certId },
    data: {
      fileKey: saved.key,
      fileSize: saved.size,
      issuedAt: cert.issuedAt ?? new Date(),
      nameRu: nameRu?.trim() || null,
      nameLat: nameLat?.trim() || null,
    },
  });
  await deleteUpload(cert.fileKey);

  const link = `/learn/certificates/${cert.id}`;
  await notify(
    cert.userId,
    firstIssue ? `Вы получили сертификат: «${cert.course.title}»` : `Сертификат обновлён: «${cert.course.title}»`,
    firstIssue
      ? "Поздравляем! Сертификат о прохождении курса доступен для просмотра и скачивания."
      : "Выпущена новая версия вашего сертификата.",
    link,
  );
  if (firstIssue) await logActivity(cert.userId, "certificate_issued", cert.course.title, link);
  return { firstIssue, names };
}
