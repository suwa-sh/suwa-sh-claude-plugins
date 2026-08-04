"use client";

import { Button } from "../ui/Button";

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/** 削除・予約キャンセルなど、取り消しにくい操作の確認ダイアログ。 */
export function ConfirmActionModal({ isOpen, title, message, confirmLabel, onConfirm, onCancel, isLoading = false }: ConfirmActionModalProps) {
  if (!isOpen) return null;

  return (
    <div
      aria-hidden={!isOpen}
      onMouseDown={(event) => { if (event.currentTarget === event.target && !isLoading) onCancel(); }}
      style={{ alignItems: "center", background: "color-mix(in srgb, var(--color-black) 55%, transparent)", display: "flex", inset: 0, justifyContent: "center", padding: "var(--page-padding)", position: "fixed", zIndex: 1000 }}
    >
      <section aria-describedby="confirm-action-description" aria-labelledby="confirm-action-title" aria-modal="true" role="dialog" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "var(--card-radius)", boxShadow: "var(--shadow-lg)", color: "var(--foreground)", maxWidth: "30rem", padding: "var(--card-padding)", width: "100%" }}>
        <h2 id="confirm-action-title" style={{ fontSize: "var(--font-size-xl)", margin: 0 }}>{title}</h2>
        <p id="confirm-action-description" style={{ color: "var(--muted-foreground)", lineHeight: 1.7, margin: "var(--spacing-3) 0 var(--spacing-6)" }}>{message}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-3)", justifyContent: "flex-end" }}>
          <Button disabled={isLoading} onClick={onCancel} variant="outline">戻る</Button>
          <Button disabled={isLoading} onClick={onConfirm} variant="destructive">{isLoading ? "処理中" : confirmLabel}</Button>
        </div>
      </section>
    </div>
  );
}
