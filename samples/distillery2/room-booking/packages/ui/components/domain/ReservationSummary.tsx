import { Icon } from '../ui/Icon';
import { ReservationStatusBadge } from './ReservationStatusBadge';
import type { ReservationStatus } from './types';

export interface ReservationSummaryProps {
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  status?: ReservationStatus;
}

/** 予約の要点 (会議室・日付・時間帯・状態)。予約の完了と取消の確認で使う */
export function ReservationSummary({
  roomName,
  date,
  startTime,
  endTime,
  status,
}: ReservationSummaryProps) {
  return (
    <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2 text-sm">
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="door" size={16} />
        会議室
      </dt>
      <dd className="font-medium">{roomName}</dd>
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="calendar" size={16} />
        日付
      </dt>
      <dd className="font-medium">{date}</dd>
      <dt className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="clock" size={16} />
        時間帯
      </dt>
      <dd className="font-medium">
        {startTime}〜{endTime}
      </dd>
      {status && (
        <>
          <dt className="text-muted-foreground">状態</dt>
          <dd>
            <ReservationStatusBadge status={status} />
          </dd>
        </>
      )}
    </dl>
  );
}
