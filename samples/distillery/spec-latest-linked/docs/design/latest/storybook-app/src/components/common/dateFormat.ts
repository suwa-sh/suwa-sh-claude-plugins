/**
 * 日付・期限の表示規約（唯一の正本: `_cross-cutting/ux-ui/ui-design.md`）を実装するフォーマッタ。
 * API は ISO 8601 のまま扱い、画面表示にのみここを通す（画面・コンポーネントで toLocaleDateString を直書きしない）。
 */

function toDate(iso: string): Date {
  return new Date(iso)
}

/** 画面表示（日付）: `YYYY年M月D日` */
export function formatDateLong(iso: string): string {
  return toDate(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** 画面表示（日時）: `YYYY年M月D日 HH:mm`（秒は表示しない） */
export function formatDateTimeLong(iso: string): string {
  const d = toDate(iso)
  const date = formatDateLong(iso)
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date} ${time}`
}

/** 画面表示（テーブルの列）: `YYYY/MM/DD`（桁揃え） */
export function formatDateTable(iso: string): string {
  const d = toDate(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}/${m}/${day}`
}

/** 日付のみに丸めた UTC ミリ秒（暦日差の算出に使う） */
/**
 * UTC の暦日境界に丸める。ローカルタイムゾーンの getter（`getFullYear` 等）は使わない
 * （日付のみの ISO 文字列は UTC 深夜として解釈されるため、ローカル getter と混在すると
 * タイムゾーンによって暦日がずれる）。
 */
function startOfDay(iso: string): number {
  const d = toDate(iso)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

const DAY_MS = 24 * 60 * 60 * 1000

/** 残日数（正: 期限まで N 日 / 0: 当日 / 負: N 日超過） */
export function daysUntil(deadline: string, today: string): number {
  return Math.round((startOfDay(deadline) - startOfDay(today)) / DAY_MS)
}

export type DeadlineKind = 'return' | 'pickup'

const TODAY_LABEL: Record<DeadlineKind, string> = {
  return: '本日が返却期限',
  pickup: '本日が受取期限',
}

/**
 * 残日数・超過日数の文言（`あと{N}日` / 当日 / `{N}日超過`）。
 * 種別ごとに当日文言だけを差し替える（`ui-design.md`「日付・期限の表示規約」）。
 */
export function formatRemaining(remaining: number, kind: DeadlineKind = 'return'): string {
  if (remaining > 0) return `あと${remaining}日`
  if (remaining === 0) return TODAY_LABEL[kind]
  return `${Math.abs(remaining)}日超過`
}

/** 日付と残日数の併記（例: `2026年9月16日（あと14日）`） */
export function formatDeadlineWithRemaining(deadline: string, today: string, kind: DeadlineKind = 'return'): string {
  const remaining = daysUntil(deadline, today)
  return `${formatDateLong(deadline)}（${formatRemaining(remaining, kind)}）`
}
