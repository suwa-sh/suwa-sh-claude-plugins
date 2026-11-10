import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { BusinessErrorAlert } from './BusinessErrorAlert';
import { ReservationSummary } from './ReservationSummary';
import type { ErrorCode, ReservationView } from './types';

export interface CancelConfirmPanelProps {
  reservation: ReservationView;
  submitting?: boolean;
  /** 取り消しを受け付けなかったときのエラーのコード */
  errorCode?: ErrorCode;
  onConfirm?: () => void;
  onBack?: () => void;
}

/** 予約の取り消しの確認。取り消すと空き状況に戻ることを伝える */
export function CancelConfirmPanel({
  reservation,
  submitting = false,
  errorCode,
  onConfirm,
  onBack,
}: CancelConfirmPanelProps) {
  const blocked = errorCode !== undefined && errorCode !== 'INTERNAL_ERROR';
  return (
    <Card
      title="この予約を取り消しますか"
      description="取り消した予約は元に戻せません。取り消すと、この時間帯は空きに戻ります。"
    >
      <div className="flex flex-col gap-(--section-gap)">
        {errorCode && <BusinessErrorAlert code={errorCode} />}
        <ReservationSummary
          roomName={reservation.roomName}
          date={reservation.date}
          startTime={reservation.startTime}
          endTime={reservation.endTime}
          status={reservation.status}
        />
        <div className="flex flex-wrap justify-end gap-(--component-gap)">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            自分の予約一覧に戻る
          </Button>
          {!blocked && (
            <Button variant="destructive" onClick={onConfirm} loading={submitting}>
              {submitting ? '取り消しています' : '予約を取り消す'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
