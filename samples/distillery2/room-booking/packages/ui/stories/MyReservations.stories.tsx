import type { Meta, StoryObj } from '@storybook/react-vite';
import { BusinessErrorAlert } from '../components/domain/BusinessErrorAlert';
import { MyReservationList } from '../components/domain/MyReservationList';
import type { ErrorCode, ReservationView } from '../components/domain/types';
import { AppShell } from '../components/layout/AppShell';
import { Alert } from '../components/ui/Alert';
import { sampleMyReservations, sampleUserName } from './sampleData';

/** 自分の予約一覧画面 (UC: 自分の予約一覧を確認する) */
interface ScreenProps {
  reservations: ReservationView[];
  loading?: boolean;
  errorCode?: ErrorCode;
  /** 直前に取り消した予約の表示 */
  cancelledLabel?: string;
}

function MyReservationsScreen({ reservations, loading, errorCode, cancelledLabel }: ScreenProps) {
  return (
    <AppShell
      current="my-reservations"
      userName={sampleUserName}
      title="自分の予約"
      description="自分が予約した有効な予約です。開始時刻より前であれば取り消せます。"
    >
      {cancelledLabel && (
        <Alert variant="success" title="予約を取り消しました">
          {cancelledLabel} の予約を取り消しました。この時間帯は空きに戻りました。
        </Alert>
      )}
      {errorCode ? (
        <BusinessErrorAlert code={errorCode} />
      ) : (
        <MyReservationList reservations={reservations} loading={loading} />
      )}
    </AppShell>
  );
}

const meta = {
  title: 'Screens/MyReservations',
  component: MyReservationsScreen,
  tags: ['autodocs'],
  args: { reservations: sampleMyReservations },
} satisfies Meta<typeof MyReservationsScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 有効な予約が 3 件 */
export const Default: Story = {};

/** 有効な予約が無い */
export const Empty: Story = { args: { reservations: [] } };

/** 読み込み中 */
export const Loading: Story = { args: { loading: true } };

/** 取り消した直後 (取り消した予約は一覧から外れる) */
export const AfterCancel: Story = {
  args: {
    reservations: sampleMyReservations.slice(1),
    cancelledLabel: '2026-11-05 10:00〜11:00 会議室A',
  },
};

/** システムのエラー */
// biome-ignore lint/suspicious/noShadowRestrictedNames: 画面の状態の見本名 (screens.yaml の variants) を Default / Error などの決まりに揃える
export const Error: Story = { args: { errorCode: 'INTERNAL_ERROR' } };
