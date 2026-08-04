import { Badge, type BadgeVariant } from "../ui/Badge";

export type BookLoanStatus = "available" | "on_loan" | "overdue";

export interface BookLoanStatusBadgeProps {
  status: BookLoanStatus;
}

const statusMap: Record<BookLoanStatus, { label: string; variant: BadgeVariant }> = {
  available: { label: "在庫あり", variant: "success" },
  on_loan: { label: "貸出中", variant: "info" },
  overdue: { label: "延滞中", variant: "destructive" },
};

/** 書籍貸出状態を、状態モデルに対応した色と日本語ラベルで表示する。 */
export function BookLoanStatusBadge({ status }: BookLoanStatusBadgeProps) {
  const mapped = statusMap[status];
  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
