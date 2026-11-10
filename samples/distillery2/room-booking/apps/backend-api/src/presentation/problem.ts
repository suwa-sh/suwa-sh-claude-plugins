// 業務のエラーのコードを契約のエラー型 (Problem の type・title・detail・code) と HTTP の status に変える (ADR 0023)。
import type { Response } from 'express';
import type { ErrorCode, Problem } from '../../../../packages/contracts/api/types';
import type {
  BusinessError,
  TimeRangeErrorCode,
  TimeRangeErrorReason,
} from '../domain/businessError';

/**
 * コードごとの status と利用者向けの短い説明 (status は ADR 0023、説明は契約の例の title)。
 * 実装済みの UC が返すコードだけを持つ。ほかのコードは、それを返す UC が足す
 */
const PROBLEM_OF = {
  VALIDATION_ERROR: { status: 400, title: '要求の形が正しくありません' },
  UNAUTHENTICATED: { status: 401, title: '認証が必要です' },
  INVALID_TIME_RANGE: { status: 422, title: '時間帯が正しくありません' },
  NOT_ON_30_MINUTES: { status: 422, title: '時刻は 30 分刻みで指定してください' },
  PAST_TIME_SLOT: { status: 422, title: '過去の時間帯は予約できません' },
  ROOM_NOT_FOUND: { status: 404, title: '会議室が見つかりません' },
  SLOT_OVERLAPS: { status: 409, title: '時間帯が既存の予約と重なります' },
  INTERNAL_ERROR: {
    status: 500,
    title: 'システムのエラーが発生しました。時間をおいて試してください',
  },
} as const satisfies Partial<Record<ErrorCode, { status: number; title: string }>>;

export type ProblemCode = keyof typeof PROBLEM_OF;

/** 時間帯の業務のエラー (domain の TimeRange.create が返す形) */
export type TimeRangeBusinessError = BusinessError<TimeRangeErrorCode, TimeRangeErrorReason>;

/**
 * 業務のエラーの利用者向けの詳しい説明 (Problem の detail。ADR 0023)。利用者が直せる言葉で書く (docs/rules/common.md の推奨)。
 * INVALID_TIME_RANGE は理由 (ADR 0017 の検証 (1)・(3)) ごとに直し方を分ける
 */
const INVALID_TIME_RANGE_DETAIL: Record<TimeRangeErrorReason, string> = {
  START_NOT_BEFORE_END: '開始の日時を終了の日時より前にしてください',
  OUTSIDE_BUSINESS_DAY:
    '時間帯は開始の日付の 0:00 から翌日 0:00 までに収めてください (日をまたぐ時間帯は指定できません)',
};
const NOT_ON_30_MINUTES_DETAIL = '開始と終了の時刻は 0 分か 30 分ちょうどにしてください';

/** 予約で起きる業務のエラーの詳しい説明 (利用者が直せる言葉) */
const RESERVATION_DETAIL = {
  PAST_TIME_SLOT: '開始が現在以降の時間帯を指定してください',
  ROOM_NOT_FOUND: '会議室の一覧にある会議室を指定してください',
  SLOT_OVERLAPS: 'この会議室のこの時間帯は予約済みです。別の時間帯か別の会議室を指定してください',
} as const;

/** 業務のエラー (時間帯の検証と予約の業務のエラー) */
export type AppBusinessError = BusinessError<
  TimeRangeErrorCode | keyof typeof RESERVATION_DETAIL,
  TimeRangeErrorReason
>;

export function businessErrorDetail(error: AppBusinessError): string {
  if (error.code === 'NOT_ON_30_MINUTES') return NOT_ON_30_MINUTES_DETAIL;
  if (error.code !== 'INVALID_TIME_RANGE') return RESERVATION_DETAIL[error.code];
  return error.reason
    ? INVALID_TIME_RANGE_DETAIL[error.reason]
    : '時間帯の開始と終了を見直してください';
}

export interface ProblemOptions {
  detail?: string;
  correlationId?: string;
}

export function problemOf(code: ProblemCode, options: ProblemOptions = {}): Problem {
  const { status, title } = PROBLEM_OF[code];
  const { detail, correlationId } = options;
  return {
    type: 'about:blank',
    title,
    status,
    ...(detail ? { detail } : {}),
    code,
    ...(correlationId ? { correlationId } : {}),
  };
}

export function sendProblem(res: Response, code: ProblemCode, options: ProblemOptions = {}): void {
  const problem = problemOf(code, options);
  res.status(problem.status).type('application/problem+json').send(JSON.stringify(problem));
}

/** 業務のエラーを、コードの status・title と理由の detail を持つ Problem で返す */
export function sendBusinessError(
  res: Response,
  error: AppBusinessError,
  correlationId?: string,
): void {
  sendProblem(res, error.code, { detail: businessErrorDetail(error), correlationId });
}
