import "server-only";
import nodemailer from "nodemailer";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function appUrl(p = "") {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + p;
}

export function escapeHtml(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f5fb;font-family:Arial,sans-serif;color:#1f2333">
<div style="max-width:560px;margin:24px auto;background:#fff;border-radius:12px;padding:28px">
<h2 style="margin:0 0 16px;color:#4338ca">${title}</h2>${body}
<p style="margin-top:28px;color:#8a8fa3;font-size:12px">Это автоматическое письмо онлайн-школы PrideX. Если вы не совершали это действие, просто проигнорируйте его.</p>
</div></body></html>`;
}

function button(href: string, label: string) {
  return `<p><a href="${href}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${label}</a></p>
<p style="font-size:12px;color:#8a8fa3">Или откройте ссылку: ${href}</p>`;
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!process.env.SMTP_HOST) {
    const dir = path.join(process.cwd(), "storage", "mail-outbox");
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, "_")}.html`);
    await writeFile(file, `<!-- To: ${to} | Subject: ${subject} -->\n${html}`);
    const link = html.match(/href="([^"]+)"/)?.[1];
    console.log(
      `[mail] SMTP не настроен. Письмо "${subject}" для ${to} сохранено: ${file}${link ? `\n[mail] Ссылка: ${link}` : ""}`,
    );
    return;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({ from: process.env.MAIL_FROM || "no-reply@example.com", to, subject, html });
}

export const mails = {
  verify: (name: string, link: string) =>
    layout(
      "Подтвердите e-mail",
      `<p>Здравствуйте, ${escapeHtml(name)}!</p><p>Чтобы завершить регистрацию, подтвердите адрес электронной почты.</p>${button(link, "Подтвердить e-mail")}`,
    ),
  reset: (name: string, link: string) =>
    layout(
      "Восстановление пароля",
      `<p>Здравствуйте, ${escapeHtml(name)}!</p><p>Мы получили запрос на смену пароля. Ссылка действует 1 час.</p>${button(link, "Задать новый пароль")}`,
    ),
  changeEmail: (name: string, link: string) =>
    layout(
      "Смена e-mail",
      `<p>Здравствуйте, ${escapeHtml(name)}!</p><p>Подтвердите, что этот адрес будет использоваться для входа в PrideX.</p>${button(link, "Подтвердить новый e-mail")}`,
    ),
};
