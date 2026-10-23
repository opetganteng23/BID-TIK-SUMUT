"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";

/** Konfirmasi tindakan destruktif. Menjelaskan dampak, fokus terperangkap dan Esc membatalkan. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = "Hapus",
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onCancel} aria-labelledby="confirm-title" className="m-auto w-[min(92vw,26rem)] rounded-[20px] border border-border bg-surface p-6 text-fg backdrop:bg-black/40">
      <h2 id="confirm-title" className="text-xl">{title}</h2>
      <div className="mt-3 text-sm text-muted">{children}</div>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" type="button" onClick={onCancel}>Batal</Button>
        <Button variant="danger" type="button" onClick={onConfirm} loading={busy}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
