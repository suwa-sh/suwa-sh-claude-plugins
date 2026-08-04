import { Badge, type BadgeVariant } from "../ui/Badge";

export type ReservationStatus = "pending" | "reserved" | "cancelled";

export interface ReservationStatusBadgeProps {
  status: ReservationStatus;
}

const statusMap: Record<ReservationStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "予約受付中", variant: "info" },
  reserved: { label: "予約確保済", variant: "success" },
  cancelled: { label: "キャンセル済", variant: "outline" },
};

/** 予約状態モデルの3状態を表示する。 */
export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  const mapped = statusMap[status];
  return <Badge variant={mapped.variant}>{mapped.label}</Badge>;
}
