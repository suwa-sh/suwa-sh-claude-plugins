import React from 'react'
import { iconPaths } from './icons.generated'

export type IconName = string

export interface IconProps {
  /** アイコン名。assets/icons/{name}.svg と 1:1 で対応する */
  name: IconName
  /** px。既定 16（本文行内サイズ） */
  size?: number
  className?: string
  /** 線幅。既定 1.75 */
  strokeWidth?: number
  /** 装飾目的なら省略。意味を持つ場合はラベルを渡す（JIS X 8341-3 AA 目標） */
  label?: string
}

/**
 * インライン SVG のアイコン。stroke に currentColor を使うため、
 * 親要素の color / CSS 変数からそのまま着色できる。
 */
export const Icon: React.FC<IconProps> = ({
  name,
  size = 16,
  className = '',
  strokeWidth = 1.75,
  label,
}) => {
  const body = iconPaths[name]
  if (!body) return null
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'text-bottom' }}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}

export const iconNames = Object.keys(iconPaths)
