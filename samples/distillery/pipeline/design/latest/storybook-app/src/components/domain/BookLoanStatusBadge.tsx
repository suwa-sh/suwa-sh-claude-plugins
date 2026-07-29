import * as React from "react";
import { Badge, BadgeVariant } from "../ui/Badge";

/** 書籍貸出状態を表すステータスバッジ。在庫あり/貸出中/延滞中の3状態 */
export type BookLoanStatus = "available" | "on_loan" | "overdue";

export interface BookLoanStatusBadgeProps {
  status: BookLoanStatus;
}

const statusMap: Record<BookLoanStatus, { label: string; variant: BadgeVariant }> = {
  available: { label: "在庫あり", variant: "success" },
  on_loan: { label: "貸出中", variant: "info" },
  overdue: { label: "延滞中", variant: "destructive" },
};

export const BookLoanStatusBadge: React.FC<BookLoanStatusBadgeProps> = ({ status }) => {
  const { label, variant } = statusMap[status];
  return <Badge variant={variant}>{label}</Badge>;
};
