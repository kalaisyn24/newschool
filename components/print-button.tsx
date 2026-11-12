"use client";

export function PrintButton({ label = "Распечатать / сохранить PDF" }: { label?: string }) {
  return (
    <button className="btn-primary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
