import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** 読み込み中の仮の枠 */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-(--radius-md) bg-skeleton', className)}
      {...rest}
    />
  );
}
