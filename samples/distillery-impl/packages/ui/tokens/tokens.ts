/**
 * デザイントークン(library-management design system)
 * 正本: design-event.yaml の visual identity。実装はここからのみ色・余白を参照する。
 */
export const colors = {
  primary: "#1e5a8a",
  primaryHover: "#174a73",
  secondary: "#5a7d9a",
  success: "#2e7d32",
  warning: "#ed6c02",
  destructive: "#c62828",
  info: "#0277bd",
  surface: "#ffffff",
  background: "#f5f7fa",
  border: "#d0d7de",
  textPrimary: "#1f2328",
  textSecondary: "#57606a",
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
} as const;

export const radius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
} as const;

export const fontSize = {
  sm: "12px",
  md: "14px",
  lg: "16px",
  xl: "20px",
} as const;
