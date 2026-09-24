/**
 * 貸出登録のドメイン例外。domain 層はログを出さず例外で結果を通知する (ADR 0003)。
 * code は契約 createLoan の Problem.code と同じ値を持つ。
 */
export type LoanRegistrationErrorCode =
  | 'book-not-found'
  | 'patron-not-found'
  | 'book-on-loan'
  | 'book-on-hold-for-another-patron'
  | 'patron-has-overdue-loan'
  | 'version-conflict';

export class LoanRegistrationError extends Error {
  constructor(
    readonly code: LoanRegistrationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'LoanRegistrationError';
  }
}

export class BookNotFound extends LoanRegistrationError {
  constructor(readonly deleted: boolean) {
    super(
      'book-not-found',
      deleted ? '指定した書籍は削除済みのため貸し出せません' : '指定した書籍は見つかりません',
    );
  }
}

export class PatronNotFound extends LoanRegistrationError {
  constructor(readonly deleted: boolean) {
    super(
      'patron-not-found',
      deleted ? '指定した利用者は削除済みのため貸し出せません' : '指定した利用者は見つかりません',
    );
  }
}

export class BookOnLoan extends LoanRegistrationError {
  constructor() {
    super('book-on-loan', '指定した書籍は貸出中です');
  }
}

export class BookOnHoldForAnotherPatron extends LoanRegistrationError {
  constructor() {
    super('book-on-hold-for-another-patron', '指定した書籍は他の利用者のために取置中です');
  }
}

export class PatronHasOverdueLoan extends LoanRegistrationError {
  constructor() {
    super('patron-has-overdue-loan', '延滞中の貸出があるため貸し出せません');
  }
}

/** 書籍単位の楽観ロック (版番号) の不一致 (ADR 0004)。 */
export class VersionConflict extends LoanRegistrationError {
  constructor() {
    super('version-conflict', '最新の状態を取得してからやり直してください');
  }
}
