/**
 * 貸出受付画面 (LoanRegister, route /admin/loans/new) の「貸出を登録する」操作。
 *
 * 描画と切り離した入口関数で、ブラウザ無しで呼べる (UC BDD が画面 → API を in-process で通す)。
 * 出典: features/貸出業務/register-loan.feature、contract-slice の POST /loans (registerLoan)。
 * 返却期限は backend が決めた値 (応答の loan.dueDate) をそのまま表示に使い、画面では算出しない。
 */
import type {
  BookStatus,
  Problem,
  ProblemCode,
} from '../../../../../packages/contracts/library-api/types';
import { callRegisterLoan } from '../../api-client/register-loan';

export interface LoanCheckoutInput {
  /** 利用者番号 */
  patronNumber: string;
  /** 書籍ID */
  bookId: string;
}

export type LoanCheckoutView =
  | {
      kind: 'registered';
      loanId: string;
      loanedOn: string;
      dueDate: string;
      bookStatus: BookStatus;
    }
  | { kind: 'rejected'; code: ProblemCode; message: string }
  | { kind: 'failed'; status: number; message: string };

export interface SubmitLoanCheckoutOptions {
  /** API のベース URL。既定は同一オリジン */
  baseUrl?: string;
  /** 追加ヘッダ (認可トークン等) */
  headers?: Record<string, string>;
  /** 再送判定キー。省略時は呼び出しごとに新しく作る */
  idempotencyKey?: string;
}

/** 契約に無い応答 (認証切れ・サーバー障害等) で出す、利用者が次の行動を取れる文言 */
export const UNEXPECTED_FAILURE_MESSAGE =
  '貸出を登録できませんでした。時間をおいてもう一度お試しください。続く場合は管理者にお問い合わせください。';

/** 再送判定キーを作る (Idempotency-Key。契約の制約は 1〜128 文字) */
export const newIdempotencyKey = (): string => globalThis.crypto.randomUUID();

/**
 * 登録操作の結果から、次の送信で使う再送判定キーを決める。
 * 結果が確定した応答 (登録済み・貸し出せない) の後は新しいキーにし、状況が変わった後の再試行を初回と同じ応答にしない。
 * 結果が不確かな失敗 (通信できない・契約外の応答) の後は同じキーのままにし、再送で登録が重複しないようにする。
 */
export const nextIdempotencyKey = (view: LoanCheckoutView, currentKey: string): string =>
  view.kind === 'failed' ? currentKey : newIdempotencyKey();

const isProblem = (data: unknown): data is Problem =>
  typeof data === 'object' &&
  data !== null &&
  typeof (data as { code?: unknown }).code === 'string' &&
  typeof (data as { title?: unknown }).title === 'string';

export async function submitLoanCheckout(
  input: LoanCheckoutInput,
  fetchFn?: typeof fetch,
  options: SubmitLoanCheckoutOptions = {},
): Promise<LoanCheckoutView> {
  const result = await callRegisterLoan(
    { patronNumber: input.patronNumber, bookId: input.bookId },
    {
      fetch: fetchFn,
      baseUrl: options.baseUrl,
      headers: options.headers,
      idempotencyKey: options.idempotencyKey ?? newIdempotencyKey(),
    },
  );

  if (result.status === 201) {
    const { loan, bookStatus } = result.data;
    return {
      kind: 'registered',
      loanId: loan.loanId,
      loanedOn: loan.loanedOn,
      dueDate: loan.dueDate,
      bookStatus,
    };
  }
  // 400 / 409 は契約上 Problem。契約外のステータスでも Problem 形式なら同じく利用者向けの title を出す
  const data: unknown = result.data;
  if (isProblem(data)) {
    return { kind: 'rejected', code: data.code, message: data.title };
  }
  return { kind: 'failed', status: result.status, message: UNEXPECTED_FAILURE_MESSAGE };
}
