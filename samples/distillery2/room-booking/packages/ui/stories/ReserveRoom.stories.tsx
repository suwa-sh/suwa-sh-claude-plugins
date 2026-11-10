import type { Meta, StoryObj } from '@storybook/react-vite';
import { BusinessErrorAlert } from '../components/domain/BusinessErrorAlert';
import { ReservationForm, type ReservationFormValue } from '../components/domain/ReservationForm';
import { ReservationSummary } from '../components/domain/ReservationSummary';
import type { ErrorCode } from '../components/domain/types';
import { AppShell } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { sampleRooms, sampleUserName } from './sampleData';

/** 予約画面 (UC: 会議室を予約する) */
interface ScreenProps {
  value: ReservationFormValue;
  submitting?: boolean;
  errorCode?: ErrorCode;
  completed?: boolean;
  /** 未入力で送ろうとした後 (未入力の項目ごとに入力を促す) */
  showMissing?: boolean;
  /** 会議室の一覧を読めなかった (会議室を選べないので、読み直すまで予約を続けられない) */
  roomsUnavailable?: boolean;
}

function ReserveRoomScreen({
  value,
  submitting,
  errorCode,
  completed,
  showMissing,
  roomsUnavailable,
}: ScreenProps) {
  const roomName = sampleRooms.find((r) => r.roomId === value.roomId)?.name ?? '';
  return (
    <AppShell current="availability" userName={sampleUserName} title="会議室を予約する">
      <div className="grid grid-cols-12 gap-(--section-gap)">
        <div className="col-span-8 col-start-3 flex flex-col gap-(--section-gap)">
          {completed ? (
            <>
              <Alert variant="success" title="予約しました">
                自分の予約一覧から、開始時刻より前であれば取り消せます。
              </Alert>
              <Card title="予約の内容">
                <div className="flex flex-col gap-(--section-gap)">
                  <ReservationSummary
                    roomName={roomName}
                    date={value.date}
                    startTime={value.startTime}
                    endTime={value.endTime}
                    status="reserved"
                  />
                  <div className="flex flex-wrap justify-end gap-(--component-gap)">
                    <Button variant="outline">空き状況に戻る</Button>
                    <Button>自分の予約一覧を見る</Button>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <>
              {roomsUnavailable && (
                <div className="flex flex-col gap-(--component-gap)">
                  <BusinessErrorAlert code="INTERNAL_ERROR" />
                  <div className="flex flex-wrap justify-end gap-(--component-gap)">
                    <Button variant="outline">会議室の一覧を読み直す</Button>
                  </div>
                </div>
              )}
              <ReservationForm
                rooms={roomsUnavailable ? [] : sampleRooms}
                value={value}
                submitting={submitting}
                errorCode={errorCode}
                showMissing={showMissing}
              />
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

const baseValue: ReservationFormValue = {
  roomId: 'room-1',
  date: '2026-11-05',
  startTime: '10:00',
  endTime: '11:00',
};

const meta = {
  title: 'Screens/ReserveRoom',
  component: ReserveRoomScreen,
  tags: ['autodocs'],
  args: { value: baseValue },
} satisfies Meta<typeof ReserveRoomScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 空き状況から会議室と時間帯を引き継いだ入力 */
export const Default: Story = {};

/** 送信中 */
export const Submitting: Story = { args: { submitting: true } };

/** 予約が成立した */
export const Completed: Story = { args: { completed: true } };

/** 同じ会議室で時間帯が重なる予約がある (同時に予約されて先を越された場合も) */
export const SlotOverlaps: Story = { args: { errorCode: 'SLOT_OVERLAPS' } };

/** 開始時刻が現在より前 */
export const PastTimeSlot: Story = { args: { errorCode: 'PAST_TIME_SLOT' } };

/** 開始時刻が終了時刻より前でない */
export const InvalidTimeRange: Story = {
  args: {
    value: { ...baseValue, startTime: '11:00', endTime: '11:00' },
    errorCode: 'INVALID_TIME_RANGE',
  },
};

/** 必須項目 (会議室・日付・開始時刻・終了時刻) を入力せずに送ろうとした。送らずに止め、未入力の項目ごとに入力を促す */
export const MissingRequired: Story = {
  args: {
    value: { roomId: '', date: '', startTime: '', endTime: '' },
    showMissing: true,
  },
};

/**
 * 会議室の一覧を読めなかった (システムのエラー)。会議室を選べず、未入力のままでは送れないので、
 * 「会議室の一覧を読み直す」で読み直す。引き継いだ日付と時刻は残す
 */
export const RoomsUnavailable: Story = {
  args: { value: { ...baseValue, roomId: '' }, roomsUnavailable: true },
};

/** 30 分刻みでない時刻 (API が受け付けなかった) */
export const NotOn30Minutes: Story = { args: { errorCode: 'NOT_ON_30_MINUTES' } };

/** システムのエラー */
// biome-ignore lint/suspicious/noShadowRestrictedNames: 画面の状態の見本名 (screens.yaml の variants) を Default / Error などの決まりに揃える
export const Error: Story = { args: { errorCode: 'INTERNAL_ERROR' } };
