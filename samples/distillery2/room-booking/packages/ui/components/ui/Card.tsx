import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** マウスを乗せたときに影を強める */
  hoverable?: boolean;
}

export function Card({
  title,
  description,
  hoverable = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <section
      className={cn(
        'rounded-(--card-radius) border border-card-border bg-card p-(--card-padding) shadow-(--card-shadow)',
        hoverable && 'transition-shadow duration-(--duration-normal) hover:shadow-(--shadow-md)',
        className,
      )}
      {...rest}
    >
      {(title || description) && (
        <header className="mb-4 flex flex-col gap-1">
          {title && (
            <h2 className="font-heading text-lg font-bold leading-(--line-height-heading)">
              {title}
            </h2>
          )}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
