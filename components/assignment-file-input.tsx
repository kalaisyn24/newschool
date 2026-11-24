"use client";

import { useState } from "react";
import { ASSIGNMENT_FILE_EXT, ASSIGNMENT_FILE_MAX, ASSIGNMENT_FILE_TOO_BIG } from "@/lib/assignment-file";
import { formatBytes } from "@/lib/format";

/** Optional file for an assignment answer; files over 2 MB are rejected right away with a hint. */
export function AssignmentFileInput() {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <span className="label">Файл (необязательно)</span>
      <input
        name="file"
        type="file"
        accept={ASSIGNMENT_FILE_EXT.map((e) => `.${e}`).join(",")}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700"
        onChange={(e) => {
          const input = e.currentTarget;
          const f = input.files?.[0];
          if (f && f.size > ASSIGNMENT_FILE_MAX) {
            setError(`Размер файла ${formatBytes(f.size)}. ${ASSIGNMENT_FILE_TOO_BIG}`);
            input.value = ""; // do not send it
          } else {
            setError(null);
          }
        }}
      />
      {error ? (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
          {error}
        </p>
      ) : (
        <span className="hint block">
          До 2 МБ: PDF, Word, Excel, PowerPoint, изображения, архив. Если файл больше — загрузите его в Google Диск и вставьте ссылку в
          текст ответа.
        </span>
      )}
    </div>
  );
}
