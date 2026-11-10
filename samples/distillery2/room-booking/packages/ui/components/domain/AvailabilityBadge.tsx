import { cn } from '../../lib/cn';
import { Icon } from '../ui/Icon';
import type { Availability } from './types';

export interface AvailabilityBadgeProps {
  availability: Availability;
  className?: string;
}

const view: Record<
  Availability,
  { label: string; icon: 'check-circle' | 'x-circle'; className: string }
> = {
  available: {
    label: '空き',
    icon: 'check-circle',
    className: 'bg-availability-free-bg text-availability-free-fg',
  },
  reserved: {
    label: '予約済み',
    icon: 'x-circle',
    className: 'bg-availability-reserved-bg text-availability-reserved-fg',
  },
};

/** 会議室の空き状況。色だけでなく文字 (空き / 予約済み) と形で示す (ADR 0008) */
export function AvailabilityBadge({ availability, className }: AvailabilityBadgeProps) {
  const v = view[availability];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-(--badge-radius) px-2.5 py-0.5 text-sm font-medium',
        v.className,
        className,
      )}
    >
      <Icon name={v.icon} size={16} />
      {v.label}
    </span>
  );
}
