import React from 'react'

export type LogoVariant = 'full' | 'icon' | 'stacked'

export interface LogoProps {
  variant?: LogoVariant
  /** px。既定は variant ごとの推奨サイズ */
  height?: number
  className?: string
}

const src: Record<LogoVariant, string> = {
  full: '/assets/logo-full.svg',
  icon: '/assets/logo-icon.svg',
  stacked: '/assets/logo-stacked.svg',
}

const defaultHeight: Record<LogoVariant, number> = {
  full: 32,
  icon: 24,
  stacked: 96,
}

/**
 * ブランドロゴ。ヘッダー・サイドバー・ログイン画面等で使う唯一の入口。
 * `<img src="/assets/logo-*.svg">` を画面側に直書きしない。
 */
export const Logo: React.FC<LogoProps> = ({ variant = 'full', height, className = '' }) => (
  <img
    src={src[variant]}
    alt="Libra 図書館蔵書管理システム"
    height={height ?? defaultHeight[variant]}
    className={className}
    style={{ display: 'inline-block', height: height ?? defaultHeight[variant], width: 'auto' }}
  />
)
