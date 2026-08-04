import type { CSSProperties } from "react";
import { Icon } from "../ui/Icon";
import { BookLoanStatusBadge, type BookLoanStatus } from "./BookLoanStatusBadge";

export interface BookCardProps {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  genre: string;
  materialType: string;
  location: string;
  status: BookLoanStatus;
  variant?: "compact" | "detailed";
}

const cardStyle: CSSProperties = {
  background: "var(--card-bg)",
  border: "1px solid var(--card-border)",
  borderRadius: "var(--card-radius)",
  boxShadow: "var(--card-shadow)",
  color: "var(--foreground)",
  display: "grid",
  gap: "var(--spacing-3)",
  minWidth: 0,
  padding: "var(--card-padding)",
};

const metaStyle: CSSProperties = {
  alignItems: "center",
  color: "var(--muted-foreground)",
  display: "flex",
  fontSize: "var(--font-size-sm)",
  gap: "var(--spacing-2)",
};

/** 蔵書検索・蔵書管理で使う書籍情報カード。 */
export function BookCard({
  title,
  author,
  isbn,
  publisher,
  genre,
  materialType,
  location,
  status,
  variant = "compact",
}: BookCardProps) {
  return (
    <article style={cardStyle}>
      <div style={{ alignItems: "flex-start", display: "flex", gap: "var(--spacing-3)", justifyContent: "space-between" }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: "var(--font-size-lg)", fontWeight: "var(--font-weight-semibold)", lineHeight: 1.5, margin: 0 }}>
            {title}
          </h3>
          <p style={{ color: "var(--muted-foreground)", margin: "var(--spacing-1) 0 0" }}>{author}</p>
        </div>
        <BookLoanStatusBadge status={status} />
      </div>

      <div style={metaStyle}>
        <Icon name="map-pin" size={16} aria-hidden />
        <span>{location}</span>
      </div>

      {variant === "detailed" && (
        <dl style={{ display: "grid", gap: "var(--spacing-2)", margin: 0 }}>
          {[
            ["ISBN", isbn],
            ["出版社", publisher],
            ["ジャンル", genre],
            ["資料種別", materialType],
          ].map(([label, value]) => (
            <div key={label} style={{ display: "grid", fontSize: "var(--font-size-sm)", gap: "var(--spacing-2)", gridTemplateColumns: "5rem minmax(0, 1fr)" }}>
              <dt style={{ color: "var(--muted-foreground)" }}>{label}</dt>
              <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
