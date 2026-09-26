/**
 * 貸出登録の判定結果を HTTP 応答に変換する処理の単体テスト。409 の文言は契約 examples と照合する。
 */
import { describe, expect, it } from 'vitest';
import type { RegisterLoanDecision } from '../usecase/register-loan';
import { renderRegisterLoanDecision } from './register-loan-response';

const AWAITING_BOOK = '2c7f9b3e-6a1d-4c8e-9f2b-7d4a1e6c3b5f';

function rejected(
  queueStanding: Extract<RegisterLoanDecision, { kind: 'rejected' }>['queueStanding'],
): RegisterLoanDecision {
  return {
    kind: 'rejected',
    code: 'not_first_in_reservation_queue',
    request: { bookId: AWAITING_BOOK, patronNumber: 'P-00000001' },
    queueStanding,
  };
}

describe('貸出登録の応答', () => {
  it('予約順 1 位以外の利用者で拒否した場合、契約 example と同じ 409 の本文にすること', () => {
    // Arrange
    const decision = rejected('not_first');

    // Act
    const response = renderRegisterLoanDecision(decision);

    // Assert
    expect(response.status).toBe(409);
    expect(JSON.parse(response.body ?? 'null')).toEqual({
      type: 'https://library.example/problems/not-first-in-reservation-queue',
      title: 'この書籍は予約順 1 位の利用者にだけ貸し出せます',
      status: 409,
      code: 'not_first_in_reservation_queue',
      detail: `書籍 ${AWAITING_BOOK} は予約待ちで、利用者 P-00000001 は予約順 1 位ではありません`,
    });
  });

  it('本人が予約順 1 位で未通知のため拒否した場合、detail を「まだ通知済になっていない」にすること', () => {
    // Arrange
    const decision = rejected('first_not_notified');

    // Act
    const response = renderRegisterLoanDecision(decision);

    // Assert
    expect(JSON.parse(response.body ?? 'null')).toMatchObject({
      code: 'not_first_in_reservation_queue',
      detail: `書籍 ${AWAITING_BOOK} は予約待ちで、利用者 P-00000001 の予約はまだ通知済になっていません`,
    });
  });

  it('書籍が登録されていない場合、404 not_found の本文にすること', () => {
    // Arrange
    const decision: RegisterLoanDecision = { kind: 'book_not_found', bookId: AWAITING_BOOK };

    // Act
    const response = renderRegisterLoanDecision(decision);

    // Assert
    expect(response.status).toBe(404);
    expect(JSON.parse(response.body ?? 'null')).toMatchObject({ code: 'not_found', status: 404 });
  });
});
