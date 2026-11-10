import type { ErrorCode } from './types';

/**
 * 契約の ErrorCode ごとに、画面に出す理由の文 (ADR 0008: 業務のエラーはコードに応じた理由の文を表示する)。
 * title は見出し、detail は次に何をすればよいか。
 */
export const errorMessages: Record<ErrorCode, { title: string; detail: string }> = {
  VALIDATION_ERROR: {
    title: '入力の内容を確認してください',
    detail:
      '必要な項目が足りないか、日付・時刻の形式が正しくありません。入力した内容を確かめて、もう一度操作してください。',
  },
  UNAUTHENTICATED: {
    title: 'ログインが必要です',
    detail: 'ログインの状態を確認できませんでした。もう一度ログインしてから操作してください。',
  },
  INVALID_TIME_RANGE: {
    title: '時間帯が正しくありません',
    detail:
      '開始は終了より前にし、時間帯はその日の 0:00 から翌日 0:00 までにしてください。開始時刻と終了時刻を選び直してください。',
  },
  NOT_ON_30_MINUTES: {
    title: '時刻は 30 分刻みで指定してください',
    detail: '毎時 0 分か 30 分を選んでください。',
  },
  PAST_TIME_SLOT: {
    title: '過ぎた時刻は予約できません',
    detail: '開始時刻を現在より後にしてください。',
  },
  SLOT_OVERLAPS: {
    title: 'この時間帯は既に予約されています',
    detail:
      '同じ会議室で時間帯が重なる予約があります。空き状況を確認して、別の時間帯か会議室を選んでください。',
  },
  ALREADY_CANCELLED: {
    title: 'この予約は既に取り消されています',
    detail: '自分の予約一覧に戻って、最新の状態を確認してください。',
  },
  CANCEL_DEADLINE_PASSED: {
    title: '開始時刻を過ぎた予約は取り消せません',
    detail: '取り消しは開始時刻より前までです。',
  },
  NOT_RESERVATION_OWNER: {
    title: '自分の予約だけ取り消せます',
    detail: 'この予約は別の社員が予約したものです。',
  },
  RESERVATION_NOT_FOUND: {
    title: '予約が見つかりません',
    detail: '自分の予約一覧に戻って、取り消す予約を選び直してください。',
  },
  ROOM_NOT_FOUND: {
    title: '会議室が見つかりません',
    detail: '空き状況の画面に戻って、会議室を選び直してください。',
  },
  INTERNAL_ERROR: {
    title: 'システムのエラーが起きました',
    detail: '時間をおいてもう一度操作してください。続く場合は管理者に連絡してください。',
  },
};
