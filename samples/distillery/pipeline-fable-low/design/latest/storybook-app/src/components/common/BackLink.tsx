import React from 'react'
import { Button } from '@/components/ui/Button'

export interface BackLinkProps {
  label: string
  to: string
  returnQuery?: Record<string, string | number | undefined>
  /** 確定後の戻りでは true（履歴を残さない） */
  replace?: boolean
}

/**
 * 論理上の親画面へ戻るリンク。履歴の 1 つ前ではなく親画面 URL に returnQuery（検索条件・ページ）を引き継いで遷移する。
 */
export const BackLink: React.FC<BackLinkProps> = ({ label, to, returnQuery, replace }) => {
  const href = (() => {
    if (!returnQuery) return to
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(returnQuery)) {
      if (value !== undefined && value !== '') params.set(key, String(value))
    }
    const qs = params.toString()
    return qs ? `${to}?${qs}` : to
  })()

  const handleClick = () => {
    if (typeof window === 'undefined') return
    if (replace) window.location.replace(href)
    else window.location.assign(href)
  }

  return (
    <Button variant="ghost" size="sm" icon="arrow-left" onClick={handleClick}>
      {label}
    </Button>
  )
}
