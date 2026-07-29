import * as React from "react";
import { colors, spacing, radius, fontSize } from "../../tokens/tokens";
import { BookLoanStatusBadge, BookLoanStatus } from "./BookLoanStatusBadge";

/** 書籍情報をカード形式で表示するコンポーネント。蔵書検索結果の一覧表示に使用 */
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

export const BookCard: React.FC<BookCardProps> = ({
  title,
  author,
  isbn,
  publisher,
  genre,
  materialType,
  location,
  status,
  variant = "compact",
}) => (
  <div
    style={{
      background: colors.surface,
      border: `1px solid ${colors.border}`,
      borderRadius: radius.md,
      padding: spacing.md,
      display: "flex",
      flexDirection: "column",
      gap: spacing.sm,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <strong style={{ fontSize: fontSize.lg, color: colors.textPrimary }}>{title}</strong>
      <BookLoanStatusBadge status={status} />
    </div>
    <span style={{ fontSize: fontSize.md, color: colors.textSecondary }}>{author}</span>
    {variant === "detailed" && (
      <dl style={{ margin: 0, fontSize: fontSize.sm, color: colors.textSecondary }}>
        <div>ISBN: {isbn}</div>
        <div>出版社: {publisher}</div>
        <div>ジャンル: {genre}</div>
        <div>資料種別: {materialType}</div>
        <div>配架場所: {location}</div>
      </dl>
    )}
  </div>
);
