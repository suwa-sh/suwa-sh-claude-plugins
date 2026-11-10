import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from './Icon';

export type AlertVariant = 'info' | 'success' | 'warning' | 'destructive';

const variantClass: Record<AlertVariant, string> = {
  info: 'border-info bg-info-light text-info',
  success: 'border-success bg-success-light text-success',
  warning: 'border-warning bg-warning-light text-warning',
  destructive: 'border-destructive bg-destructive-light text-destructive',
};

const variantIcon: Record<AlertVariant, IconName> = {
  info: 'alert-circle',
  success: 'check-circle',
  warning: 'alert-circle',
  destructive: 'x-circle',
};

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: AlertVariant;
  title: ReactNode;
}

export function Alert({ variant = 'info', title, className, children, ...rest }: AlertProps) {
  return (
    <div
      role={variant === 'destructive' ? 'alert' : 'status'}
      className={cn(
        'flex gap-3 rounded-(--card-radius) border-l-4 px-4 py-3',
        variantClass[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={variantIcon[variant]} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm font-bold">{title}</p>
        {children && <div className="text-sm text-foreground">{children}</div>}
      </div>
    </div>
  );
}
