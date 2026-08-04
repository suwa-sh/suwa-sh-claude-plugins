import type { CSSProperties } from "react";
import { Badge } from "../ui/Badge";

export interface LoanRecordProps {
  bookTitle: string;
  borrowerName: string;
  loanDate: string;
  dueDate: string;
  returnDate: string | null;
  isOverdue: boolean;
}

const labelStyle: CSSProperties = {
  color: "var(--muted-foreground)",
  fontSize: "var(--font-size-xs)",
  marginBottom: "var(--spacing-1)",
};

/** 貸出状況・貸出履歴・延滞管理で共用する貸出記録。 */
export function LoanRecord({ bookTitle, borrowerName, loanDate, dueDate, returnDate, isOverdue }: LoanRecordProps) {
  const cells = [
    ["利用者", borrowerName],
    ["貸出日", loanDate],
    ["返却期限", dueDate],
    ["返却日", returnDate ?? "未返却"],
  ];

  return (
    <article
      style={{
        alignItems: "center",
        background: isOverdue ? "var(--destructive-light)" : "var(--card-bg)",
        border: `1px solid ${isOverdue ? "var(--destructive)" : "var(--card-border)"}`,
        borderRadius: "var(--radius-lg)",
        color: "var(--foreground)",
        display: "grid",
        gap: "var(--spacing-4)",
        gridTemplateColumns: "minmax(12rem, 2fr) repeat(4, minmax(7rem, 1fr)) auto",
        minWidth: "max-content",
        padding: "var(--spacing-4)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={labelStyle}>書籍</div>
        <strong style={{ overflowWrap: "anywhere" }}>{bookTitle}</strong>
      </div>
      {cells.map(([label, value]) => (
        <div key={label}>
          <div style={labelStyle}>{label}</div>
          <span>{value}</span>
        </div>
      ))}
      <Badge variant={isOverdue ? "destructive" : returnDate ? "success" : "info"}>
        {isOverdue ? "延滞中" : returnDate ? "返却済" : "貸出中"}
      </Badge>
    </article>
  );
}
