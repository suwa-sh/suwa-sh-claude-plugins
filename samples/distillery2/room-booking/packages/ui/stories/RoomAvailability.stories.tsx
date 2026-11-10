import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { AvailabilitySearchForm } from '../components/domain/AvailabilitySearchForm';
import { BusinessErrorAlert } from '../components/domain/BusinessErrorAlert';
import { RoomAvailabilityList } from '../components/domain/RoomAvailabilityList';
import type { ErrorCode, RoomAvailabilityItem, TimeSlotValue } from '../components/domain/types';
import { AppShell } from '../components/layout/AppShell';
import { sampleAvailability, sampleSlot, sampleUserName } from './sampleData';

/**
 * 空き状況画面 (UC: 会議室の空き状況を照会する / 会議室を予約する の入口)
 *
 * 画面の間の移り方:
 * - 空きの会議室の行の「予約する」を押すと、予約画面 (/reservations/new) へ移る。
 *   選んだ会議室と、照会した日付・開始時刻・終了時刻を予約画面へ引き継ぐ
 *   (予約画面の見本 Screens/ReserveRoom の Default が、引き継いだ入力の状態)。
 * - 照会した時間帯が現在より前 (過去) のときは、押しても予約できないので
 *   onReserve を渡さず「予約する」の列ごと出さない (見本 PastSlot)。
 */
interface ScreenProps {
  slot: TimeSlotValue;
  rooms: RoomAvailabilityItem[];
  loading?: boolean;
  errorCode?: ErrorCode;
  /**
   * 空きの会議室で「予約する」を押したとき (会議室の ID を受け取り、照会した日付・時間帯と合わせて
   * 予約画面 /reservations/new へ移る)。過去の時間帯を照会したときは渡さない
   */
  onReserve?: (roomId: string) => void;
}

function RoomAvailabilityScreen({ slot, rooms, loading, errorCode, onReserve }: ScreenProps) {
  const showList = !errorCode || loading;
  return (
    <AppShell
      current="availability"
      userName={sampleUserName}
      title="会議室の空き状況"
      description="日付と時間帯を選ぶと、会議室ごとに空きか予約済みかが分かります。"
    >
      <AvailabilitySearchForm value={slot} errorCode={errorCode} searching={loading} />
      {errorCode && <BusinessErrorAlert code={errorCode} />}
      {showList && (
        <RoomAvailabilityList
          rooms={rooms}
          loading={loading}
          slotLabel={`${slot.date} ${slot.startTime}〜${slot.endTime}`}
          onReserve={onReserve}
        />
      )}
    </AppShell>
  );
}

const meta = {
  title: 'Screens/RoomAvailability',
  component: RoomAvailabilityScreen,
  tags: ['autodocs'],
  args: { slot: sampleSlot, rooms: sampleAvailability },
  parameters: {
    docs: {
      description: {
        component:
          '空き状況画面。空きの会議室の行の「予約する」を押すと、選んだ会議室と照会した日付・時間帯を持って予約画面 (/reservations/new) へ移る (見本 Reservable)。照会した時間帯が過去のときは「予約する」を出さない (見本 PastSlot)。',
      },
    },
  },
} satisfies Meta<typeof RoomAvailabilityScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 空きと予約済みが混ざった一覧 (照会だけの状態。予約への入口は Reservable) */
export const Default: Story = {};

/**
 * 予約できる: 空きの会議室の行に「予約する」を出す (予約済みの行は「予約できません」)。
 * 押すと、選んだ会議室と照会した日付・時間帯 (例: 2026-11-05 10:00〜11:00) を持って
 * 予約画面 (/reservations/new) へ移る
 */
export const Reservable: Story = { args: { onReserve: fn() } };

/**
 * 過去の時間帯を照会した (照会した時間帯が現在より前)。空き状況は見せるが、
 * 押しても予約できないので onReserve を渡さず「予約する」を出さない
 */
export const PastSlot: Story = {
  args: {
    slot: { date: '2026-11-04', startTime: '10:00', endTime: '11:00' },
  },
};

/** 照会中 */
export const Loading: Story = { args: { loading: true } };

/** 時間帯が正しくない (例: 終了時刻が開始時刻より前。空き状況は出さず理由を示す) */
export const InvalidTimeRange: Story = {
  args: {
    slot: { date: '2026-11-05', startTime: '11:00', endTime: '10:00' },
    errorCode: 'INVALID_TIME_RANGE',
  },
};

/** 開始・終了が 30 分刻みでない時間帯 (API が受け付けなかった。空き状況は出さず理由を示す) */
export const NotOn30Minutes: Story = { args: { errorCode: 'NOT_ON_30_MINUTES' } };

/** システムのエラー */
// biome-ignore lint/suspicious/noShadowRestrictedNames: 画面の状態の見本名 (screens.yaml の variants) を Default / Error などの決まりに揃える
export const Error: Story = { args: { errorCode: 'INTERNAL_ERROR' } };
