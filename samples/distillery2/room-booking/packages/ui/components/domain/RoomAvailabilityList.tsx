import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { AvailabilityBadge } from './AvailabilityBadge';
import type { RoomAvailabilityItem } from './types';

export interface RoomAvailabilityListProps {
  rooms: RoomAvailabilityItem[];
  /** 照会した時間帯の表示 (例: 2026-11-05 10:00〜11:00) */
  slotLabel?: string;
  loading?: boolean;
  /**
   * 空きの会議室で「予約する」を押したとき。
   * 渡さないときは操作の列ごと描かない (空きは予約できることまでは示さないため。
   * 予約を扱わない画面や過去の時間帯の照会で、押しても何も起きないボタンを出さない)
   */
  onReserve?: (roomId: string) => void;
}

/** 指定した時間帯の、会議室ごとの空き状況の一覧 */
export function RoomAvailabilityList({
  rooms,
  slotLabel,
  loading = false,
  onReserve,
}: RoomAvailabilityListProps) {
  const reservable = onReserve !== undefined;
  return (
    <div className="overflow-hidden rounded-(--card-radius) border border-card-border bg-card">
      <table className="w-full border-collapse text-sm">
        {slotLabel && (
          <caption className="px-4 py-3 text-left text-sm text-muted-foreground">
            {slotLabel} の空き状況
          </caption>
        )}
        <thead className="bg-table-header-bg">
          <tr>
            <th scope="col" className="px-4 py-2 text-left font-medium">
              会議室
            </th>
            <th scope="col" className="w-40 px-4 py-2 text-left font-medium">
              空き状況
            </th>
            {reservable && (
              <th scope="col" className="w-36 px-4 py-2 text-right font-medium">
                <span className="sr-only">操作</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody aria-busy={loading || undefined}>
          {loading
            ? [0, 1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-t border-table-row-border">
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-5 w-20" />
                  </td>
                  {reservable && (
                    <td className="px-4 py-3">
                      <Skeleton className="ml-auto h-8 w-24" />
                    </td>
                  )}
                </tr>
              ))
            : rooms.map((room) => (
                <tr key={room.roomId} className="border-t border-table-row-border">
                  <th scope="row" className="px-4 py-3 text-left font-medium">
                    {room.roomName}
                  </th>
                  <td className="px-4 py-3">
                    <AvailabilityBadge availability={room.availability} />
                  </td>
                  {reservable && (
                    <td className="px-4 py-3 text-right">
                      {room.availability === 'available' ? (
                        <Button
                          size="sm"
                          onClick={() => onReserve(room.roomId)}
                          aria-label={`${room.roomName}を予約する`}
                        >
                          予約する
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">予約できません</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
        </tbody>
      </table>
      {loading && (
        <p className="sr-only" aria-live="polite">
          空き状況を読み込んでいます
        </p>
      )}
    </div>
  );
}
