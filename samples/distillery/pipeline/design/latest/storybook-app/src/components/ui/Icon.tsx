import * as React from "react";
import "./ui.css";

export const iconNames = [
  "alert-triangle",
  "search",
  "book",
  "bookmark",
  "calendar",
  "chart",
  "clock",
  "filter",
  "mail",
  "settings",
  "shield-check",
  "user",
  "users",
] as const;

/** 独自の追加アイコンも扱える。カタログ掲載名は iconNames を参照する。 */
export type IconName = (typeof iconNames)[number] | (string & {});

export interface IconProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  name: IconName;
  size?: number;
  /** 意味を持つアイコンの場合だけ指定する。省略時は装飾画像として扱う。 */
  alt?: string;
}

/** public/assets/icons の outlined SVG を表示する共通アイコン。 */
export const Icon = ({
  name,
  size = 24,
  alt = "",
  className = "",
  style,
  ...props
}: IconProps) => (
  <span
    role={alt ? "img" : undefined}
    aria-label={alt || undefined}
    aria-hidden={alt ? undefined : true}
    className={`ls-icon ${className}`.trim()}
    style={{
      width: size,
      height: size,
      backgroundColor: "currentColor",
      WebkitMaskImage: `url(/assets/icons/${name}.svg)`,
      maskImage: `url(/assets/icons/${name}.svg)`,
      WebkitMaskPosition: "center",
      maskPosition: "center",
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "contain",
      maskSize: "contain",
      ...style,
    }}
    {...props}
  />
);
