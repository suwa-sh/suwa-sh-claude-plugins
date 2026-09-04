import React from 'react'
import { ToggleGroup } from '@/components/ui/ToggleGroup'

export interface ScopeToggleProps {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  /** 既定 md。sm 未満では md 固定（タップ領域 44px） */
  size?: 'sm' | 'md'
  ariaLabel: string
}

/**
 * 3〜5 択の表示範囲切替を ToggleGroup（single）で統一する。
 * URL クエリとの同期・page リセットは呼び出し側（useUrlQueryState）が行う。
 */
export const ScopeToggle: React.FC<ScopeToggleProps> = ({ options, value, onChange, size = 'md', ariaLabel }) => (
  <ToggleGroup mode="single" options={options} value={value} onChange={onChange} size={size} label={ariaLabel} />
)
