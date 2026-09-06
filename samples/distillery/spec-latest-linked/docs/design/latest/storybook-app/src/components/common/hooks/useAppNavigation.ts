import React from 'react'
import { AppNavigationContext, type AppNavigationValue } from '@/components/common/AppShell'

/**
 * 画面遷移の唯一の API（CR-d0f57ea2-010）。
 *
 * - 遷移は必ずルート id で指定する（`navigate('patron-book-detail', { bookId })`）。
 * - 画面・コンポーネント側で URL 文字列を組み立てない。href も `href()` から得る。
 * - AppShell の外（単体 Story など）で呼ぶと例外にして、シェル未装着を早期に検出する。
 */
export function useAppNavigation(): AppNavigationValue {
  const value = React.useContext(AppNavigationContext)
  if (!value) {
    throw new Error('useAppNavigation must be used inside <AppShell>')
  }
  return value
}
