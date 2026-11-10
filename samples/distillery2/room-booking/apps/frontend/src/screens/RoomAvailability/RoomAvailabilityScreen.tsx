// 空き状況の画面 (route /availability)。構造の正は packages/ui/stories/RoomAvailability.stories.tsx
import {
  AppShell,
  AvailabilitySearchForm,
  BusinessErrorAlert,
  RoomAvailabilityList,
  type TimeSlotValue,
} from '@repo/ui';
import { useEffect, useState } from 'react';
import type { SessionTokenProvider } from '../../api/tokenProvider';
import { navigate as appNavigate } from '../../navigation';
import { initialSlot } from './initialSlot';
import { isPastSlot, reserveRoomPath } from './reserveEntry';
import { type RoomAvailabilityState, showRoomAvailability } from './showRoomAvailability';

export interface RoomAvailabilityScreenProps {
  tokens: Pick<SessionTokenProvider, 'getAccessToken' | 'signIn' | 'getDisplayName'>;
  /** 生成クライアントの options.fetch の元 (省略時はグローバルの fetch) */
  fetch?: typeof fetch;
  /** 現在時刻の口 (時間帯の初期値の日付と、照会した時間帯が過去かの表示に使う) */
  clock?: { now(): Date };
  /** 画面の移動 (省略時は App.tsx の navigate) */
  navigate?: (path: string) => void;
}

const systemClock = { now: () => new Date() };

export function RoomAvailabilityScreen({
  tokens,
  fetch,
  clock = systemClock,
  navigate = appNavigate,
}: RoomAvailabilityScreenProps) {
  const [slot, setSlot] = useState<TimeSlotValue>(() => initialSlot(clock.now()));
  const [searched, setSearched] = useState<TimeSlotValue | undefined>();
  const [state, setState] = useState<RoomAvailabilityState>({ kind: 'idle' });
  const [searching, setSearching] = useState(false);
  const [userName, setUserName] = useState<string | undefined>();

  useEffect(() => {
    tokens
      .getDisplayName()
      .then(setUserName)
      .catch(() => setUserName(undefined));
  }, [tokens]);

  const search = async () => {
    // 照会中は送信できなくする (二重の送信を防ぐ)
    if (searching) return;
    setSearching(true);
    const target = slot;
    try {
      setState(await showRoomAvailability(target, { tokens, fetch }));
      setSearched(target);
    } finally {
      setSearching(false);
    }
  };

  /** 時間帯を変えたら、変える前の時間帯に対する照会のエラーを消す (照会の結果の一覧は照会した時間帯の見出しのまま残す) */
  const changeSlot = (next: TimeSlotValue) => {
    setSlot(next);
    setState((s) => (s.kind === 'error' ? { kind: 'idle' } : s));
  };

  const errorCode = state.kind === 'error' ? state.code : undefined;
  const rooms = state.kind === 'loaded' ? state.rooms : [];
  const shown = searched ?? slot;
  // 予約への入口 (UC 会議室を予約する)。照会した時間帯が過去なら渡さず、「予約する」の列ごと出さない
  const onReserve =
    searched && !isPastSlot(searched, clock.now())
      ? (roomId: string) => navigate(reserveRoomPath(roomId, searched))
      : undefined;
  return (
    <AppShell
      current="availability"
      userName={userName}
      title="会議室の空き状況"
      description="日付と時間帯を選ぶと、会議室ごとに空きか予約済みかが分かります。"
    >
      <AvailabilitySearchForm
        value={slot}
        onChange={changeSlot}
        onSearch={() => void search()}
        errorCode={errorCode}
        searching={searching}
      />
      {errorCode && !searching && <BusinessErrorAlert code={errorCode} />}
      {(searching || state.kind === 'loaded') && (
        <RoomAvailabilityList
          rooms={rooms}
          loading={searching}
          slotLabel={`${shown.date} ${shown.startTime}〜${shown.endTime}`}
          onReserve={searching ? undefined : onReserve}
        />
      )}
    </AppShell>
  );
}
