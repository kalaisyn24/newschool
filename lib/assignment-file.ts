// Client-safe limits for files attached to practical assignments.

export const ASSIGNMENT_FILE_MAX = 2 * 1024 * 1024; // 2 MB
export const ASSIGNMENT_FILE_EXT = [
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "zip", "rar", "jpg", "jpeg", "png", "webp", "gif", "mp3",
];
export const ASSIGNMENT_FILE_TOO_BIG =
  "Файл больше 2 МБ. Загрузите его в Google Диск (откройте доступ по ссылке) и вставьте ссылку в текст ответа.";
