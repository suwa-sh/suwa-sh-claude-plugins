import * as React from "react";
import { colors, spacing, radius, fontSize } from "../../tokens/tokens";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  default: { background: colors.primary, color: colors.surface, border: "none" },
  secondary: { background: colors.secondary, color: colors.surface, border: "none" },
  outline: {
    background: "transparent",
    color: colors.primary,
    border: `1px solid ${colors.primary}`,
  },
  ghost: { background: "transparent", color: colors.primary, border: "none" },
  destructive: { background: colors.destructive, color: colors.surface, border: "none" },
};

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: `${spacing.xs} ${spacing.sm}`, fontSize: fontSize.sm },
  md: { padding: `${spacing.sm} ${spacing.md}`, fontSize: fontSize.md },
  lg: { padding: `${spacing.md} ${spacing.lg}`, fontSize: fontSize.lg },
};

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "md",
  style,
  children,
  ...rest
}) => (
  <button
    style={{
      borderRadius: radius.md,
      cursor: "pointer",
      fontWeight: 600,
      ...variantStyles[variant],
      ...sizeStyles[size],
      ...style,
    }}
    {...rest}
  >
    {children}
  </button>
);
