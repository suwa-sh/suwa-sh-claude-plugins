/**
 * 返却登録の判定結果を HTTP 応答 (ステータスと本文) に変換する。
 * usecase はこの応答を Idempotency-Key に保存し、同じキーの再送でそのまま返す (契約 parameters/IdempotencyKey)。
 * 404 / 409 の detail は契約 registerReturn の examples と同じ文言にする。
 */
import type { Problem, ReturnRegistration } from '../../../../packages/contracts/library-api/types';
import type { RecordedResponse } from '../usecase/idempotent-command';
import type { RegisterReturnDecision, RegisterReturnResponder } from '../usecase/register-return';
import { problem } from './problem';

const CREATED = 201;

function toResponse(status: number, body: ReturnRegistration | Problem): RecordedResponse {
  return { status, body: JSON.stringify(body) };
}

export function renderRegisterReturnDecision(decision: RegisterReturnDecision): RecordedResponse {
  switch (decision.kind) {
    case 'returned':
      return toResponse(CREATED, decision.registration);
    case 'book_not_found': {
      const body = problem('not_found', { detail: `書籍 ${decision.bookId} は見つかりません` });
      return toResponse(body.status, body);
    }
    case 'rejected': {
      const body = problem(decision.code, {
        detail: `書籍 ${decision.bookId} には未返却の貸出がありません`,
      });
      return toResponse(body.status, body);
    }
  }
}

export const registerReturnResponder: RegisterReturnResponder = {
  render: renderRegisterReturnDecision,
};
