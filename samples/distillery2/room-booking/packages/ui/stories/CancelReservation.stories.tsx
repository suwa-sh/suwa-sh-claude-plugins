import type { Meta, StoryObj } from '@storybook/react-vite';
import { CancelConfirmPanel } from '../components/domain/CancelConfirmPanel';
import type { ErrorCode, ReservationView } from '../components/domain/types';
import { AppShell } from '../components/layout/AppShell';
import { sampleMyReservations, sampleUserName } from './sampleData';

/** 予約取消確認画面 (UC: 予約を取り消す) */
interface ScreenProps {
  reservation: ReservationView;
  submitting?: boolean;
  errorCode?: ErrorCode;
}

function CancelReservationScreen({ reservation, submitting, errorCode }: ScreenProps) {
  return (
    <AppShell current="my-reservations" userName={sampleUserName} title="予約の取り消し">
      <div className="grid grid-cols-12 gap-(--section-gap)">
        <div className="col-span-8 col-start-3">
          <CancelConfirmPanel
            reservation={reservation}
            submitting={submitting}
            errorCode={errorCode}
          />
        </div>
      </div>
    </AppShell>
  );
}

const target = sampleMyReservations[0];

const meta = {
  title: 'Screens/CancelReservation',
  component: CancelReservationScreen,
  tags: ['autodocs'],
  args: { reservation: target },
} satisfies Meta<typeof CancelReservationScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 取り消す予約の確認 */
export const Default: Story = {};

/** 取り消し中 */
export const Submitting: Story = { args: { submitting: true } };

/** 開始時刻を過ぎていて取り消せない */
export const CancelDeadlinePassed: Story = { args: { errorCode: 'CANCEL_DEADLINE_PASSED' } };

/** 既に取り消されている */
export const AlreadyCancelled: Story = {
  args: { reservation: { ...target, status: 'cancelled' }, errorCode: 'ALREADY_CANCELLED' },
};

/** 本人の予約ではない */
export const NotOwner: Story = { args: { errorCode: 'NOT_RESERVATION_OWNER' } };

/** 予約が見つからない */
export const NotFound: Story = { args: { errorCode: 'RESERVATION_NOT_FOUND' } };

/** システムのエラー (もう一度押せる) */
// biome-ignore lint/suspicious/noShadowRestrictedNames: 画面の状態の見本名 (screens.yaml の variants) を Default / Error などの決まりに揃える
export const Error: Story = { args: { errorCode: 'INTERNAL_ERROR' } };
