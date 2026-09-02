import React from 'react'
import { Card } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { ToggleGroup } from '../ui/ToggleGroup'
import { searchConditionTypes, genres, materialTypes } from './stateMaps'

export interface BookSearchFilterValue {
  keyword: string
  /** 検索条件種別（単一選択） */
  conditionType: string[]
  genres: string[]
  materialTypes: string[]
  inStockOnly: boolean
}

export interface BookSearchFilterProps {
  value: BookSearchFilterValue
  onChange: (next: BookSearchFilterValue) => void
  onSubmit?: () => void
  /** 該当件数。undefined なら件数行を出さない */
  resultCount?: number
}

/** 初期リリース未対応の資料種別（arch: 電子書籍は次期リリース） */
const UNSUPPORTED_MATERIAL_TYPES: readonly string[] = ['電子書籍']
const UNSUPPORTED_NOTE = '電子書籍は初期リリース未対応です'

const toOptions = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }))

/**
 * 蔵書検索画面・レファレンス検索画面で共用するフィルター。
 * 選択肢は Badge ではなく ToggleGroup（button トグル）で表現する。
 */
export const BookSearchFilter: React.FC<BookSearchFilterProps> = ({
  value,
  onChange,
  onSubmit,
  resultCount,
}) => {
  const patch = (p: Partial<BookSearchFilterValue>) => onChange({ ...value, ...p })

  const selectedCount =
    value.conditionType.length +
    value.genres.length +
    value.materialTypes.length +
    (value.inStockOnly ? 1 : 0)

  const reset = () =>
    onChange({
      keyword: '',
      conditionType: [],
      genres: [],
      materialTypes: [],
      inStockOnly: false,
    })

  return (
    <Card>
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)', minWidth: 0 }}>
        {/* キーワード */}
        <div className="flex items-end" style={{ gap: 'var(--spacing-2)', minWidth: 0 }}>
          <div className="flex-1 min-w-0">
            <Input
              label="キーワード"
              iconLeft="search"
              placeholder="書名・著者名・ISBN で検索"
              value={value.keyword}
              onChange={(e) => patch({ keyword: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSubmit?.()
              }}
            />
          </div>
          <Button iconLeft="search" onClick={onSubmit}>
            検索
          </Button>
        </div>

        <ToggleGroup
          label="検索条件種別"
          mode="single"
          options={toOptions(searchConditionTypes)}
          value={value.conditionType}
          onChange={(next) => patch({ conditionType: next })}
        />

        <ToggleGroup
          label="ジャンル"
          mode="multi"
          options={toOptions(genres)}
          value={value.genres}
          onChange={(next) => patch({ genres: next })}
        />

        {/* 資料種別: 電子書籍は初期リリース未対応のため無効化して注記する */}
        <div className="flex flex-col" style={{ gap: 'var(--spacing-2)', minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 500,
              color: 'var(--foreground-secondary)',
            }}
          >
            資料種別
          </span>
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            <ToggleGroup
              mode="multi"
              options={toOptions(
                materialTypes.filter((m) => !UNSUPPORTED_MATERIAL_TYPES.includes(m)),
              )}
              value={value.materialTypes}
              onChange={(next) => patch({ materialTypes: next })}
            />
            {materialTypes
              .filter((m) => UNSUPPORTED_MATERIAL_TYPES.includes(m))
              .map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled
                  aria-pressed={false}
                  aria-describedby="material-type-note"
                  title={UNSUPPORTED_NOTE}
                  className="inline-flex items-center whitespace-nowrap"
                  style={{
                    height: 'var(--button-height-md)',
                    padding: '0 var(--spacing-3)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 500,
                    background: 'var(--background-muted)',
                    color: 'var(--foreground-muted)',
                    border: '1px solid var(--border)',
                    lineHeight: 1,
                    cursor: 'not-allowed',
                    opacity: 0.55,
                  }}
                >
                  {m}
                </button>
              ))}
          </div>
          <span
            id="material-type-note"
            className="inline-flex items-center"
            style={{
              gap: 'var(--spacing-1)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
            }}
          >
            <Icon name="info" size={12} />
            {UNSUPPORTED_NOTE}
          </span>
        </div>

        {/* 在庫ありのみ / リセット / 件数 */}
        <div
          className="flex flex-wrap items-center justify-between"
          style={{ gap: 'var(--spacing-3)', minWidth: 0 }}
        >
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            <button
              type="button"
              aria-pressed={value.inStockOnly}
              data-selected={value.inStockOnly}
              onClick={() => patch({ inStockOnly: !value.inStockOnly })}
              className="ds-toggle inline-flex items-center whitespace-nowrap transition-colors"
              style={{
                gap: 'var(--spacing-1)',
                height: 'var(--button-height-md)',
                padding: '0 var(--spacing-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                background: value.inStockOnly ? 'var(--primary)' : 'var(--background)',
                color: value.inStockOnly
                  ? 'var(--primary-foreground)'
                  : 'var(--foreground-secondary)',
                border: `1px solid ${value.inStockOnly ? 'var(--primary)' : 'var(--border)'}`,
                transitionDuration: 'var(--duration-fast)',
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              <Icon name="check-circle" size={12} />
              在庫ありのみ
            </button>
            <Button
              variant="ghost"
              size="sm"
              iconLeft="refresh-cw"
              onClick={reset}
              disabled={selectedCount === 0 && value.keyword === ''}
            >
              条件をリセット
            </Button>
          </div>

          {resultCount !== undefined && (
            <span
              aria-live="polite"
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--foreground-secondary)',
              }}
            >
              該当{' '}
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                  color: 'var(--foreground)',
                }}
              >
                {resultCount.toLocaleString('ja-JP')}
              </span>{' '}
              件
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}
