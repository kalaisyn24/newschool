import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@/lib/generated/prisma/enums";
import { readSession } from "@/lib/session";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
};

/** Data Access Layer: the only place that turns the cookie into a user. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await readSession();
  if (!session) return null;
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    emailVerified: Boolean(u.emailVerified),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Learning area: any signed-in user with a confirmed e-mail. */
export async function requireLearner(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.emailVerified) redirect("/verify-email");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export function homeFor(role: Role) {
  if (role === "ADMIN") return "/admin";
  if (role === "SUPPORT") return "/support";
  return "/learn";
}
