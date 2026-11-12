"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { cx } from "@/components/ui";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText,
  name,
  value,
}: {
  children: ReactNode;
  className?: string;
  pendingText?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value}>
      {pending && <Spinner />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

export function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />;
}

/**
 * A form bound to a server action of shape (prev, formData) => ActionState.
 * Shows error / success messages and field errors (via <FieldError name>).
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  encType,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode | ((state: ActionState) => ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  encType?: string;
}) {
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={className} encType={encType}>
      {state.error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
          {state.error}
        </div>
      )}
      {state.ok && state.message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">
          {state.message}
        </div>
      )}
      <FieldErrorsContext errors={state.fieldErrors} />
      {typeof children === "function" ? children(state) : children}
    </form>
  );
}

// Field errors are rendered under inputs through a data attribute lookup to keep forms simple.
function FieldErrorsContext({ errors }: { errors?: Record<string, string> }) {
  if (!errors || !Object.keys(errors).length) return null;
  return (
    <ul className="mb-4 space-y-1 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      {Object.entries(errors).map(([k, v]) => (
        <li key={k}>{v}</li>
      ))}
    </ul>
  );
}

/** Button that asks for confirmation before submitting its form. */
export function ConfirmButton({
  children,
  message,
  className = "btn-danger",
  formAction,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  formAction?: (fd: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={cx(className)}
      disabled={pending}
      formAction={formAction}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending && <Spinner />}
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Toggle({
  name,
  defaultChecked,
  label,
  hint,
}: {
  name: string;
  defaultChecked?: boolean;
  label: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:bg-slate-50">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-brand-600 after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:after:translate-x-4" />
      <span>
        <span className="block text-sm font-medium text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}
