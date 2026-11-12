"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ChatMessage } from "@/lib/support-actions";
import { Spinner } from "@/components/forms";
import { Avatar, cx } from "@/components/ui";

const POLL_MS = 4000;

function time(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function Chat({
  conversationId,
  meId,
  initial,
  closed,
  send,
  viewerIsStaff,
}: {
  conversationId: string;
  meId: string;
  initial: ChatMessage[];
  closed: boolean;
  viewerIsStaff: boolean;
  send: (conversationId: string, body: string) => Promise<{ error?: string; message?: ChatMessage }>;
}) {
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [isClosed, setClosed] = useState(closed);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef(initial.at(-1)?.createdAt ?? "");

  // keep in sync when the server re-renders with a new status (e.g. after "close" action)
  const [prevClosed, setPrevClosed] = useState(closed);
  if (closed !== prevClosed) {
    setPrevClosed(closed);
    setClosed(closed);
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/support/${conversationId}/messages?after=${encodeURIComponent(lastRef.current)}`, {
          cache: "no-store",
        });
        if (!res.ok || stop) return;
        const data = (await res.json()) as { status: string; messages: ChatMessage[] };
        setClosed(data.status === "CLOSED");
        if (data.messages.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const add = data.messages.filter((m) => !ids.has(m.id));
            return add.length ? [...prev, ...add] : prev;
          });
          lastRef.current = data.messages.at(-1)!.createdAt;
        }
      } catch {
        /* ignore network errors */
      }
    };
    const t = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [conversationId]);

  function submit() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const r = await send(conversationId, body);
      if (r.error) return setError(r.error);
      if (r.message) {
        setMessages((prev) => (prev.some((m) => m.id === r.message!.id) ? prev : [...prev, r.message!]));
        lastRef.current = r.message.createdAt;
        setText("");
        setClosed(false);
      }
    });
  }

  return (
    <div className="card flex h-[calc(100vh-14rem)] min-h-[420px] flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/50 p-4 sm:p-6">
        {messages.length === 0 && <p className="text-center text-sm text-slate-400">Сообщений пока нет</p>}
        {messages.map((m) => {
          const mine = m.senderId === meId;
          return (
            <div key={m.id} className={cx("flex items-end gap-2.5", mine && "flex-row-reverse")}>
              <Avatar name={m.senderName} size={30} />
              <div className={cx("max-w-[80%] sm:max-w-[70%]", mine && "text-right")}>
                <p className="mb-1 text-[11px] text-slate-500">
                  {m.senderName}
                  {m.staff && !viewerIsStaff && <span className="ml-1 text-emerald-600">· поддержка</span>}
                  {!m.staff && viewerIsStaff && <span className="ml-1 text-brand-600">· студент</span>}
                  <span className="ml-1">· {time(m.createdAt)}</span>
                </p>
                <div
                  className={cx(
                    "inline-block rounded-2xl px-4 py-2.5 text-left text-sm break-words whitespace-pre-wrap",
                    mine ? "rounded-br-md bg-brand-600 text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800",
                  )}
                >
                  {m.body}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
        {isClosed && (
          <p className="mb-2 text-xs text-slate-500">Обращение закрыто. Отправьте сообщение, чтобы открыть его снова.</p>
        )}
        {error && <p className="mb-2 text-xs text-rose-600">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Напишите сообщение… (Enter — отправить, Shift+Enter — новая строка)"
            className="input min-h-[48px] resize-none"
          />
          <button className="btn-primary h-12 shrink-0" onClick={submit} disabled={pending || !text.trim()}>
            {pending ? <Spinner /> : "Отправить"}
          </button>
        </div>
      </div>
    </div>
  );
}
