import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import type { TokenType } from "@/lib/generated/prisma/enums";
import { appUrl, mails, sendMail } from "@/lib/mail";

const TTL: Record<TokenType, number> = {
  VERIFY_EMAIL: 48 * 3600e3,
  RESET_PASSWORD: 3600e3,
  CHANGE_EMAIL: 24 * 3600e3,
};

export async function issueToken(userId: string, type: TokenType, newEmail?: string) {
  // one live token per purpose
  await db.token.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomToken();
  await db.token.create({
    data: { userId, type, tokenHash: sha256(token), newEmail, expiresAt: new Date(Date.now() + TTL[type]) },
  });
  return token;
}

async function findValid(raw: string, type: TokenType) {
  if (!raw) return null;
  await connection();
  const row = await db.token.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

/** Validates and marks the token as used. Returns the token row or null. */
export async function consumeToken(raw: string, type: TokenType) {
  const row = await findValid(raw, type);
  if (!row) return null;
  const res = await db.token.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return res.count === 1 ? row : null;
}

export async function peekToken(raw: string, type: TokenType) {
  return findValid(raw, type);
}

export async function sendVerificationEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL");
  await sendMail(user.email, "Подтверждение e-mail", mails.verify(user.name, appUrl(`/verify-email?token=${token}`)));
}

export async function sendPasswordResetEmail(user: { id: string; email: string; name: string }) {
  const token = await issueToken(user.id, "RESET_PASSWORD");
  await sendMail(user.email, "Восстановление пароля", mails.reset(user.name, appUrl(`/reset-password?token=${token}`)));
}

export async function sendChangeEmail(user: { id: string; name: string }, newEmail: string) {
  const token = await issueToken(user.id, "CHANGE_EMAIL", newEmail);
  await sendMail(newEmail, "Подтверждение нового e-mail", mails.changeEmail(user.name, appUrl(`/confirm-email?token=${token}`)));
}
