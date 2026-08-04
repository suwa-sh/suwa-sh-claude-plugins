import * as React from "react";
import "./ui.css";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "virtual"
  | "outline";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/** 状態や短い属性値を簡潔に示すラベル。選択操作には使用しない。 */
export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "default", className = "", ...props }, ref) => (
    <span
      ref={ref}
      className={`ls-badge ls-badge--${variant} ${className}`.trim()}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
