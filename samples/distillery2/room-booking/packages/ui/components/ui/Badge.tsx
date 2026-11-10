import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'neutral'
  | 'outline';

const variantClass: Record<BadgeVariant, string> = {
  default: 'bg-primary text-primary-foreground',
  success: 'bg-success-light text-success',
  warning: 'bg-warning-light text-warning',
  destructive: 'bg-destructive-light text-destructive',
  info: 'bg-info-light text-info',
  neutral: 'bg-neutral-light text-neutral',
  outline: 'border border-border text-foreground',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** 状態の表示。色だけに頼らず、必ず文字を入れる */
export function Badge({ variant = 'default', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-(--badge-radius) px-2.5 py-0.5 text-xs font-medium',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
