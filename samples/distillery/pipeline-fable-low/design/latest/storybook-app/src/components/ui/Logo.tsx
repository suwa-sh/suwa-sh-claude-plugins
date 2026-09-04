import React from 'react'

export interface LogoProps {
  variant?: 'full' | 'icon' | 'stacked'
  height?: number
  className?: string
}

const src = {
  full: '/assets/logo-full.svg',
  icon: '/assets/logo-icon.svg',
  stacked: '/assets/logo-stacked.svg',
}

// eslint-disable-next-line @next/next/no-img-element
export const Logo: React.FC<LogoProps> = ({ variant = 'full', height = 32, className = '' }) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src[variant]} alt="Libro 図書館蔵書管理システム" height={height} style={{ height, width: 'auto' }} className={className} />
)
