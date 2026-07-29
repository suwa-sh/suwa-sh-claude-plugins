import * as React from "react";
import { colors, spacing, radius, fontSize } from "../../tokens/tokens";

export type BadgeVariant = "default" | "success" | "warning" | "destructive" | "info" | "outline";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: colors.secondary, color: colors.surface },
  success: { background: colors.success, color: colors.surface },
  warning: { background: colors.warning, color: colors.surface },
  destructive: { background: colors.destructive, color: colors.surface },
  info: { background: colors.info, color: colors.surface },
  outline: {
    background: "transparent",
    color: colors.textPrimary,
    border: `1px solid ${colors.border}`,
  },
};

export const Badge: React.FC<BadgeProps> = ({ variant = "default", children }) => (
  <span
    style={{
      display: "inline-block",
      padding: `${spacing.xs} ${spacing.sm}`,
      borderRadius: radius.sm,
      fontSize: fontSize.sm,
      fontWeight: 600,
      ...variantStyles[variant],
    }}
  >
    {children}
  </span>
);
