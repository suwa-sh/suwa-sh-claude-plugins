import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TimeSlotPicker, type TimeSlotPickerProps } from './TimeSlotPicker';
import { timeFieldErrors } from './timeFieldErrors';
import type { ErrorCode, TimeSlotValue } from './types';

export interface AvailabilitySearchFormProps {
  value: TimeSlotValue;
  onChange?: (next: TimeSlotValue) => void;
  onSearch?: () => void;
  /** 項目ごとの入力の誤り (errorCode が時間帯の誤りのときは errorCode から決めた文を優先する) */
  errors?: TimeSlotPickerProps['errors'];
  /** 照会を受け付けなかったときのエラーのコード。時間帯の誤りなら時刻の項目に文を出す */
  errorCode?: ErrorCode;
  searching?: boolean;
}

/** 空き状況を調べる日付と時間帯の入力 */
export function AvailabilitySearchForm({
  value,
  onChange,
  onSearch,
  errors,
  errorCode,
  searching = false,
}: AvailabilitySearchFormProps) {
  const fieldErrors = timeFieldErrors(errorCode) ?? errors;
  return (
    <form
      aria-label="空き状況の照会"
      className="flex flex-wrap items-end gap-(--component-gap) rounded-(--card-radius) border border-card-border bg-card p-(--card-padding)"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch?.();
      }}
    >
      <div className="min-w-0 flex-1">
        <TimeSlotPicker
          value={value}
          onChange={onChange}
          errors={fieldErrors}
          disabled={searching}
        />
      </div>
      <Button type="submit" loading={searching} className={fieldErrors ? 'mb-5' : undefined}>
        {!searching && <Icon name="search" size={16} />}
        空きを調べる
      </Button>
    </form>
  );
}
