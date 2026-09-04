import React from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { ToggleGroup } from '../ui/ToggleGroup'
import { genres, searchKinds, type BookState, type Genre, type SearchKind } from './types'

export interface BookSearchValue {
  kind: SearchKind
  query: string
  genres: Genre[]
  states: BookState[]
}

export const emptySearch: BookSearchValue = { kind: 'キーワード', query: '', genres: [], states: [] }

export interface BookSearchFilterProps {
  value: BookSearchValue
  onChange: (v: BookSearchValue) => void
  onSubmit?: (v: BookSearchValue) => void
  /** 司書向け: 在庫状況フィルターを表示 */
  variant?: 'patron' | 'staff'
  compact?: boolean
  searching?: boolean
}

const bookStates: BookState[] = ['在庫あり', '貸出中', '予約待ち']

/**
 * 検索条件種別（バリエーション）をトグルで切り替え、ジャンル / 在庫状況で絞り込む。
 * Badge をフィルター選択肢に使わず <button> トグルで実装する。
 */
export const BookSearchFilter: React.FC<BookSearchFilterProps> = ({ value, onChange, onSubmit, variant = 'patron', compact, searching }) => {
  const set = <K extends keyof BookSearchValue>(k: K, v: BookSearchValue[K]) => onChange({ ...value, [k]: v })
  const isGenreKind = value.kind === 'ジャンル'
  return (
    <form
      role="search"
      aria-label="蔵書検索"
      className="flex flex-col"
      style={{ gap: 'var(--component-gap)' }}
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit?.(value)
      }}
    >
      <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)', fontWeight: 500 }}>検索条件</span>
        <ToggleGroup<SearchKind> label="検索条件種別" size={compact ? 'sm' : 'md'} options={searchKinds.map((k) => ({ value: k, label: k }))} value={value.kind} onChange={(kind) => set('kind', kind)} />
      </div>
      {isGenreKind ? (
        <ToggleGroup<Genre> label="ジャンル" mode="multi" size={compact ? 'sm' : 'md'} options={genres.map((g) => ({ value: g, label: g }))} value={value.genres} onChange={(g) => set('genres', g)} />
      ) : (
        <div className="flex items-end" style={{ gap: 'var(--spacing-2)' }}>
          <Input
            className="flex-1 min-w-0"
            icon={value.kind === 'ISBN' ? 'hash' : 'search'}
            mono={value.kind === 'ISBN'}
            placeholder={value.kind === 'ISBN' ? '9784101010014' : `${value.kind}で探す`}
            value={value.query}
            onChange={(e) => set('query', e.target.value)}
            aria-label={`${value.kind}を入力`}
            inputMode={value.kind === 'ISBN' ? 'numeric' : undefined}
          />
          <Button type="submit" icon="search" loading={searching}>
            検索
          </Button>
        </div>
      )}
      {isGenreKind ? (
        <div>
          <Button type="submit" icon="search" loading={searching}>
            検索
          </Button>
        </div>
      ) : null}
      {variant === 'staff' ? (
        <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-3)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)', fontWeight: 500 }}>在庫状況</span>
          <ToggleGroup<BookState> label="在庫状況" mode="multi" size="sm" options={bookStates.map((s) => ({ value: s, label: s }))} value={value.states} onChange={(s) => set('states', s)} />
          {!isGenreKind ? (
            <ToggleGroup<Genre> label="ジャンルで絞り込む" mode="multi" size="sm" options={genres.map((g) => ({ value: g, label: g }))} value={value.genres} onChange={(g) => set('genres', g)} />
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
