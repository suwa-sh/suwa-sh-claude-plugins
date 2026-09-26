/**
 * 貸出登録の判定結果を HTTP 応答 (ステータスと本文) に変換する。
 * usecase はこの応答を Idempotency-Key に保存し、同じキーの再送でそのまま返す (契約 parameters/IdempotencyKey)。
 */
import type { LoanRegistration, Problem } from '../../../../packages/contracts/library-api/types';
import type {
  RecordedResponse,
  RegisterLoanDecision,
  RegisterLoanResponder,
} from '../usecase/register-loan';
import { problem } from './problem';

const CREATED = 201;

function toResponse(status: number, body: LoanRegistration | Problem): RecordedResponse {
  return { status, body: JSON.stringify(body) };
}

function problemResponse(body: Problem): RecordedResponse {
  return toResponse(body.status, body);
}

type Rejected = Extract<RegisterLoanDecision, { kind: 'rejected' }>;

/** 409 の detail。契約 examples と同じ文言にし、予約順 1 位で未通知のときだけ事実に合わせる (AssumptionRecord A-013) */
function rejectionDetail(decision: Rejected): string {
  const { bookId, patronNumber } = decision.request;
  switch (decision.code) {
    case 'book_on_loan':
      return `書籍 ${bookId} は貸出中です`;
    case 'patron_not_registered':
      return `利用者番号 ${patronNumber} の利用者は登録されていません`;
    case 'not_first_in_reservation_queue':
      return decision.queueStanding === 'first_not_notified'
        ? `書籍 ${bookId} は予約待ちで、利用者 ${patronNumber} の予約はまだ通知済になっていません`
        : `書籍 ${bookId} は予約待ちで、利用者 ${patronNumber} は予約順 1 位ではありません`;
  }
}

export function renderRegisterLoanDecision(decision: RegisterLoanDecision): RecordedResponse {
  switch (decision.kind) {
    case 'registered':
      return toResponse(CREATED, decision.registration);
    case 'book_not_found':
      return problemResponse(
        problem('not_found', { detail: `書籍 ${decision.bookId} は登録されていません` }),
      );
    case 'rejected':
      return problemResponse(problem(decision.code, { detail: rejectionDetail(decision) }));
  }
}

export const registerLoanResponder: RegisterLoanResponder = {
  render: renderRegisterLoanDecision,
};
