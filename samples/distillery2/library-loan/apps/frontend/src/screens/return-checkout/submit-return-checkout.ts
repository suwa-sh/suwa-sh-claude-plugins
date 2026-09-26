/**
 * 返却受付画面 (ReturnRegister, route /admin/returns) の「返却を登録する」操作。
 *
 * 描画と切り離した入口関数で、ブラウザ無しで呼べる (UC BDD が画面 → API を in-process で通す)。
 * 出典: features/貸出業務/register-return.feature、contract-slice の POST /returns (registerReturn)。
 * 返却日と返却後の書籍状態は backend が決めた値 (応答の loan.returnedOn / bookStatus) をそのまま表示に使い、画面では決めない。
 */
import type { BookStatus, ProblemCode } from '../../../../../packages/contracts/library-api/types';
import { callRegisterReturn } from '../../api-client/register-return';
import { newIdempotencyKey } from '../shared/idempotency-key';
import { isProblem } from '../shared/problem';

export interface ReturnCheckoutInput {
  /** 書籍ID */
  bookId: string;
}

export type ReturnCheckoutView =
  | {
      kind: 'returned';
      loanId: string;
      returnedOn: string;
      bookStatus: BookStatus;
    }
  | { kind: 'rejected'; code: ProblemCode; message: string }
  | { kind: 'failed'; status: number; message: string };

export interface SubmitReturnCheckoutOptions {
  /** API のベース URL。既定は同一オリジン */
  baseUrl?: string;
  /** 追加ヘッダ (認可トークン等) */
  headers?: Record<string, string>;
  /** 再送判定キー。省略時は呼び出しごとに新しく作る */
  idempotencyKey?: string;
}

/** 契約に無い応答 (サーバー障害等) で出す、利用者が次の行動を取れる文言 */
export const RETURN_UNEXPECTED_FAILURE_MESSAGE =
  '返却を登録できませんでした。時間をおいてもう一度お試しください。続く場合は管理者にお問い合わせください。';

export async function submitReturnCheckout(
  input: ReturnCheckoutInput,
  fetchFn?: typeof fetch,
  options: SubmitReturnCheckoutOptions = {},
): Promise<ReturnCheckoutView> {
  const result = await callRegisterReturn(
    { bookId: input.bookId },
    {
      fetch: fetchFn,
      baseUrl: options.baseUrl,
      headers: options.headers,
      idempotencyKey: options.idempotencyKey ?? newIdempotencyKey(),
    },
  );

  if (result.status === 201) {
    const { loan, bookStatus } = result.data;
    // 契約上 201 の loan.returnedOn は返却日。null は契約違反なので契約外の応答として扱う
    if (loan.returnedOn === null) {
      return { kind: 'failed', status: result.status, message: RETURN_UNEXPECTED_FAILURE_MESSAGE };
    }
    return { kind: 'returned', loanId: loan.loanId, returnedOn: loan.returnedOn, bookStatus };
  }
  // 400 / 401 / 403 / 404 / 409 は契約上 Problem。契約外のステータスでも Problem 形式なら利用者向けの title を出す
  const data: unknown = result.data;
  if (isProblem(data)) {
    return { kind: 'rejected', code: data.code, message: data.title };
  }
  return { kind: 'failed', status: result.status, message: RETURN_UNEXPECTED_FAILURE_MESSAGE };
}
