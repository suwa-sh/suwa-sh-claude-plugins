import type { ReactNode } from "react";
import { Button } from "../ui/Button";

export interface PaginatedListProps<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  onPageChange: (page: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  ariaLabel?: string;
}

/** 一覧本体とページ移動を一体化したレスポンシブなコンテナ。 */
export function PaginatedList<T>({ items, total, page, perPage, onPageChange, renderItem, ariaLabel = "検索結果" }: PaginatedListProps<T>) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(page, 1), pageCount);
  const first = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const last = Math.min(safePage * perPage, total);

  return (
    <section aria-label={ariaLabel} style={{ display: "grid", gap: "var(--spacing-4)", minWidth: 0 }}>
      <div style={{ display: "grid", gap: "var(--spacing-3)", minWidth: 0 }}>{items.map(renderItem)}</div>
      <nav aria-label={`${ariaLabel}のページ`} style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "var(--spacing-3)", justifyContent: "space-between" }}>
        <span aria-live="polite" style={{ color: "var(--muted-foreground)", fontSize: "var(--font-size-sm)" }}>{total}件中 {first}〜{last}件</span>
        <div style={{ alignItems: "center", display: "flex", gap: "var(--spacing-2)" }}>
          <Button aria-label="前のページ" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} size="sm" variant="outline">前へ</Button>
          <span style={{ minWidth: "5rem", textAlign: "center" }}>{safePage} / {pageCount}</span>
          <Button aria-label="次のページ" disabled={safePage >= pageCount} onClick={() => onPageChange(safePage + 1)} size="sm" variant="outline">次へ</Button>
        </div>
      </nav>
    </section>
  );
}
