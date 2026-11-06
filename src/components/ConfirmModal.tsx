"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} type="button">
            Keep it
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy} type="button">
            {busy ? "Working…" : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-ink-soft">{message}</p>
    </Modal>
  );
}
