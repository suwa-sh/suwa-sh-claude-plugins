import { Badge } from '../ui/Badge';
import type { ReservationStatus } from './types';

export interface ReservationStatusBadgeProps {
  status: ReservationStatus;
}

/** 予約状態 (予約済み / 取消済み) */
export function ReservationStatusBadge({ status }: ReservationStatusBadgeProps) {
  return status === 'reserved' ? (
    <Badge variant="info">予約済み</Badge>
  ) : (
    <Badge variant="neutral">取消済み</Badge>
  );
}
