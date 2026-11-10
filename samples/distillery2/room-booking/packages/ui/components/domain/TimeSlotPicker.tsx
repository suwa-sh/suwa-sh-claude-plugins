import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { endTimes, startTimes } from './timeSlots';
import type { TimeSlotValue } from './types';

export interface TimeSlotPickerProps {
  value: TimeSlotValue;
  onChange?: (next: TimeSlotValue) => void;
  /** 項目ごとの入力の誤り */
  errors?: Partial<Record<keyof TimeSlotValue, string>>;
  disabled?: boolean;
}

const toOptions = (times: string[]) => times.map((t) => ({ value: t, label: t }));
/** 開始は 00:00〜23:30 */
const startOptions = toOptions(startTimes());
/** 終了は 00:30〜24:00 (24:00 は翌日 0:00。時間帯は指定した日付の中に収める) */
const endOptions = toOptions(endTimes());

/** 日付と時間帯 (開始・終了。30 分刻み) の入力。空き状況の照会と予約で使う */
export function TimeSlotPicker({ value, onChange, errors, disabled }: TimeSlotPickerProps) {
  const set = (patch: Partial<TimeSlotValue>) => onChange?.({ ...value, ...patch });
  return (
    <fieldset
      className="flex min-w-0 flex-wrap items-start gap-(--component-gap)"
      disabled={disabled}
    >
      <legend className="sr-only">日付と時間帯</legend>
      <Input
        label="日付"
        type="date"
        value={value.date}
        onChange={(e) => set({ date: e.target.value })}
        error={errors?.date}
        className="basis-44"
      />
      <Select
        label="開始時刻"
        options={startOptions}
        placeholder="選択"
        value={value.startTime}
        onChange={(e) => set({ startTime: e.target.value })}
        error={errors?.startTime}
        className="basis-32"
      />
      <Select
        label="終了時刻"
        options={endOptions}
        placeholder="選択"
        value={value.endTime}
        onChange={(e) => set({ endTime: e.target.value })}
        error={errors?.endTime}
        className="basis-32"
      />
    </fieldset>
  );
}
