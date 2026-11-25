import "server-only";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "@/lib/crypto";

const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "storage", "uploads");

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MATERIAL_EXT = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar",
  "jpg", "jpeg", "png", "webp", "gif", "mp3",
];

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  zip: "application/zip",
  rar: "application/vnd.rar",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp3: "audio/mpeg",
};

export function mimeFor(key: string) {
  return MIME[path.extname(key).slice(1).toLowerCase()] ?? "application/octet-stream";
}

function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function saveUpload(file: File, folder: "covers" | "materials" | "certificates" | "assignments" | "profiler-cards", allowedExt: string[]) {
  const ext = path.extname(file.name).slice(1).toLowerCase();
  if (!allowedExt.includes(ext)) throw new Error(`Недопустимый тип файла: .${ext || "?"}`);
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}.${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(await file.arrayBuffer()));
  return { key, size: file.size, mimeType: mimeFor(key) };
}

/** Saves generated content (e.g. a certificate PDF) under a new random key. */
export async function saveBuffer(data: Uint8Array, folder: "certificates", ext: string) {
  const key = `${folder}/${new Date().toISOString().slice(0, 7)}/${randomToken(12)}.${ext}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return { key, size: data.byteLength };
}

export async function readUpload(key: string) {
  const full = resolveKey(key);
  const [data, info] = await Promise.all([readFile(full), stat(full)]);
  return { data, size: info.size, mimeType: mimeFor(key) };
}

export async function deleteUpload(key: string | null | undefined) {
  if (!key) return;
  await rm(resolveKey(key), { force: true }).catch(() => {});
}

/** Covers are public; stored as "/media/<key>" in Course.coverUrl. */
export function mediaUrl(key: string) {
  return `/media/${key}`;
}

export function keyFromMediaUrl(url: string | null | undefined) {
  return url?.startsWith("/media/") ? url.slice("/media/".length) : null;
}
