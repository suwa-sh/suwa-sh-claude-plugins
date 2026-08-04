import * as React from "react";
import "./ui.css";

export type LogoVariant = "full" | "icon" | "stacked";

export interface LogoProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  variant?: LogoVariant;
  width?: number;
}

const defaultWidths: Record<LogoVariant, number> = {
  full: 184,
  icon: 48,
  stacked: 112,
};

/** LibraShelf ブランドロゴ。用途に応じて3つの公式バリアントを選択する。 */
export const Logo = ({
  variant = "full",
  width,
  alt = "LibraShelf",
  className = "",
  ...props
}: LogoProps) => (
  <img
    src={`/assets/logo-${variant}.svg`}
    alt={variant === "icon" && alt === "LibraShelf" ? "LibraShelf" : alt}
    width={width ?? defaultWidths[variant]}
    className={`ls-logo ${className}`.trim()}
    {...props}
  />
);
