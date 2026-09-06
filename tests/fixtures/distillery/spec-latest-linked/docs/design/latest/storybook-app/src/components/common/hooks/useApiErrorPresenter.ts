/**
 * API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、
 * 表示先（フィールド / Alert / 再ログイン導線）と重篤度を決める（arch LR-031 / CLP-014）。
 */
export type ApiErrorCategory = 'input' | 'auth' | 'business' | 'conflict' | 'network'
export type ApiErrorTone = 'warning' | 'destructive'

export interface PresentedApiError {
  category: ApiErrorCategory
  tone: ApiErrorTone
  message: string
  /** 401 のとき true。再ログイン導線を出す */
  reauth?: boolean
  /** 403 のとき true。前画面へ戻る導線を出す */
  forbidden?: boolean
}

export function presentApiError(status: number, message: string): PresentedApiError {
  if (status === 400 || status === 422) return { category: 'input', tone: 'destructive', message }
  if (status === 401) return { category: 'auth', tone: 'destructive', message, reauth: true }
  if (status === 403) return { category: 'auth', tone: 'destructive', message, forbidden: true }
  if (status === 404) return { category: 'business', tone: 'destructive', message }
  if (status === 409) return { category: 'conflict', tone: 'warning', message }
  return { category: 'network', tone: 'destructive', message }
}

export function useApiErrorPresenter() {
  return { presentApiError }
}
