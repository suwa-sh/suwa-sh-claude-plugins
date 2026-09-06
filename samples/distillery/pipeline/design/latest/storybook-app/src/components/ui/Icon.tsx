import React from 'react'

/** public/assets/icons/*.svg と 1:1。追加時は SVG を置いてここにも名前を足す */
export const iconNames = [
  'search', 'book', 'book-open', 'library', 'user', 'users', 'user-plus', 'id-card',
  'calendar', 'calendar-clock', 'clock', 'mail', 'mail-check', 'mail-warning', 'bell',
  'alert-triangle', 'check-circle', 'check', 'x-circle', 'x', 'info', 'edit', 'trash', 'plus',
  'filter', 'chart-bar', 'trophy', 'list', 'home', 'log-out', 'eye', 'eye-off',
  'chevron-down', 'chevron-left', 'chevron-right', 'arrow-left', 'arrow-right', 'menu',
  'hash', 'tag', 'refresh-cw', 'package', 'settings', 'bookmark', 'inbox', 'rotate-ccw',
  'shield-check', 'loader', 'file-text',
] as const

export type IconName = (typeof iconNames)[number]

export interface IconProps {
  name: IconName
  size?: number
  className?: string
  /** 装飾目的のときは true（スクリーンリーダーから隠す） */
  decorative?: boolean
  label?: string
}

/**
 * SVG を CSS mask として描画するため、色は親要素の `color`（currentColor）に追従する。
 * `<img>` 方式だと currentColor が効かないため mask 方式を採用。
 */
export const Icon: React.FC<IconProps> = ({ name, size = 20, className = '', decorative = true, label }) => (
  <span
    role={decorative ? undefined : 'img'}
    aria-hidden={decorative ? true : undefined}
    aria-label={decorative ? undefined : label ?? name}
    className={`inline-block shrink-0 align-middle ${className}`}
    style={{
      width: size,
      height: size,
      backgroundColor: 'currentColor',
      WebkitMaskImage: `url(/assets/icons/${name}.svg)`,
      maskImage: `url(/assets/icons/${name}.svg)`,
      WebkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      WebkitMaskSize: 'contain',
      maskSize: 'contain',
      WebkitMaskPosition: 'center',
      maskPosition: 'center',
    }}
  />
)
