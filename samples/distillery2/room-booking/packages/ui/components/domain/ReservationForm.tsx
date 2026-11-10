import { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Select } from '../ui/Select';
import { BusinessErrorAlert } from './BusinessErrorAlert';
import { TimeSlotPicker } from './TimeSlotPicker';
import { timeFieldErrors } from './timeFieldErrors';
import type { ErrorCode, Room, TimeSlotValue } from './types';

export interface ReservationFormValue extends TimeSlotValue {
  roomId: string;
}

/** 予約に必須の項目 */
export type ReservationFormField = keyof ReservationFormValue;

/** 未入力のときに項目の下に出す文 (項目ごとに入力を促す) */
export const missingFieldText: Record<ReservationFormField, string> = {
  roomId: '会議室を選んでください',
  date: '日付を選んでください',
  startTime: '開始時刻を選んでください',
  endTime: '終了時刻を選んでください',
};

const requiredFields: readonly ReservationFormField[] = ['roomId', 'date', 'startTime', 'endTime'];

/**
 * 未入力の必須項目を返す。
 * 画面で先回りするのは未入力だけ。時間帯の正しさ・30 分刻み・過去かどうか・重なりは予約を受け付ける側が判定する。
 */
export function missingReservationFields(value: ReservationFormValue): ReservationFormField[] {
  return requiredFields.filter((f) => value[f].trim() === '');
}

export interface ReservationFormProps {
  rooms: Room[];
  value: ReservationFormValue;
  onChange?: (next: ReservationFormValue) => void;
  /** 必須項目がすべて入力されているときだけ呼ぶ (未入力があれば送らずに止め、項目ごとに入力を促す) */
  onSubmit?: () => void;
  onBack?: () => void;
  submitting?: boolean;
  /** 予約を受け付けなかったときのエラーのコード */
  errorCode?: ErrorCode;
  /** 未入力の項目のエラーを最初から出す (未入力で送ろうとした後の状態) */
  showMissing?: boolean;
}

/** 会議室・日付・開始時刻・終了時刻を指定して予約する入力 */
export function ReservationForm({
  rooms,
  value,
  onChange,
  onSubmit,
  onBack,
  submitting = false,
  errorCode,
  showMissing = false,
}: ReservationFormProps) {
  const [triedSubmit, setTriedSubmit] = useState(showMissing);
  const missing = triedSubmit || showMissing ? missingReservationFields(value) : [];
  const missingError = (field: ReservationFormField) =>
    missing.includes(field) ? missingFieldText[field] : undefined;
  const timeErrors = timeFieldErrors(errorCode);

  return (
    <Card
      title="予約の内容"
      description="時刻は 30 分刻みで選びます。開始時刻が過ぎた時間帯は予約できません。"
    >
      <form
        className="flex flex-col gap-(--section-gap)"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (missingReservationFields(value).length > 0) {
            setTriedSubmit(true);
            return;
          }
          onSubmit?.();
        }}
      >
        {errorCode && <BusinessErrorAlert code={errorCode} />}
        <Select
          label="会議室"
          options={rooms.map((r) => ({ value: r.roomId, label: r.name }))}
          placeholder="選択"
          value={value.roomId}
          onChange={(e) => onChange?.({ ...value, roomId: e.target.value })}
          error={
            missingError('roomId') ??
            (errorCode === 'ROOM_NOT_FOUND' ? '会議室を選び直してください' : undefined)
          }
          disabled={submitting}
          className="max-w-sm"
        />
        <TimeSlotPicker
          value={value}
          onChange={(slot) => onChange?.({ ...value, ...slot })}
          errors={{
            date: missingError('date') ?? timeErrors?.date,
            startTime: missingError('startTime') ?? timeErrors?.startTime,
            endTime: missingError('endTime') ?? timeErrors?.endTime,
          }}
          disabled={submitting}
        />
        <div className="flex flex-wrap justify-end gap-(--component-gap)">
          <Button variant="outline" onClick={onBack} disabled={submitting}>
            空き状況に戻る
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? '予約しています' : 'この内容で予約する'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
