export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
};

import type { ZodError } from "zod";

export function fromZod(err: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors };
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function bool(fd: FormData, key: string) {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function int(fd: FormData, key: string, fallback = 0) {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
}
