/**
 * 貸出ルールの世代。返却期限の算出には貸出日時点で有効な世代を使う (ADR 0004、rdb 契約 loan_rules)。
 */
export interface LoanRule {
  loanRuleId: string;
  loanPeriodDays: number;
  effectiveFrom: string;
}

/** 貸出日時点で有効な貸出ルールが無い (運用設定の欠落)。 */
export class LoanRuleNotConfiguredError extends Error {
  constructor(readonly loanedOn: string) {
    super(`貸出日 ${loanedOn} 時点で有効な貸出ルールがありません`);
    this.name = 'LoanRuleNotConfiguredError';
  }
}
