import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Skeleton } from '../ui/Skeleton';
import type { ReservationView } from './types';

export interface MyReservationListProps {
  /** 自分の有効な予約 (予約済み) だけを渡す */
  reservations: ReservationView[];
  loading?: boolean;
  /** 「取り消す」を押したとき (取消確認の画面へ) */
  onCancel?: (reservationId: string) => void;
}

/** 自分が予約した有効な予約の一覧。取り消す予約を選ぶ入口 */
export function MyReservationList({
  reservations,
  loading = false,
  onCancel,
}: MyReservationListProps) {
  if (!loading && reservations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-(--card-radius) border border-dashed border-border bg-card px-6 py-12 text-center">
        <Icon name="calendar" size={32} className="text-muted-foreground" />
        <p className="font-medium">有効な予約はありません</p>
        <p className="text-sm text-muted-foreground">空き状況の画面から会議室を予約できます。</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-(--card-radius) border border-card-border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-table-header-bg">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              日付
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              時間帯
            </th>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              会議室
            </th>
            <th scope="col" className="w-32 px-4 py-2 text-right font-medium">
              <span className="sr-only">操作</span>
            </th>
          </tr>
        </thead>
        <tbody aria-busy={loading || undefined}>
          {loading
            ? [0, 1, 2].map((i) => (
                <tr key={i} className="border-t border-table-row-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-28" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="ml-auto h-8 w-20" />
                  </td>
                </tr>
              ))
            : reservations.map((r) => (
                <tr key={r.reservationId} className="border-t border-table-row-border">
                  <td className="whitespace-nowrap px-4 py-3">{r.date}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.startTime}〜{r.endTime}
                  </td>
                  <td className="px-4 py-3 font-medium">{r.roomName}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCancel?.(r.reservationId)}
                      aria-label={`${r.date} ${r.startTime}〜${r.endTime} ${r.roomName}の予約を取り消す`}
                    >
                      取り消す
                    </Button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
      {loading && (
        <p className="sr-only" aria-live="polite">
          自分の予約を読み込んでいます
        </p>
      )}
    </div>
  );
}
