/**
 * 貸出期間 (バリエーション)。契約 LoanPeriodDays の enum 7 / 14 / 21。
 */
export type LoanPeriodDays = 7 | 14 | 21;

/** 利用者区分 (general=一般, child=児童, student=学生)。 */
export type PatronCategory = 'general' | 'child' | 'student';

/** 媒体種別 (paper=紙, electronic=電子)。 */
export type MediaType = 'paper' | 'electronic';

/**
 * 利用者区分 × 媒体種別 → 貸出期間 の対応表。
 *
 * 要求 (条件.tsv 返却期限算出条件) は「利用者区分と媒体種別に応じた貸出期間 (7日・14日・21日)」とだけ定め、
 * 対応表の値が無い (issue: .distillery/runs/register-loan/issues/20260924_120000_loan-period-mapping.md)。
 * 契約 createLoan の 201 例 (一般 × 紙 → 14 日) だけが確定値なので、それ以外も 14 日で仮置きする
 * (AssumptionRecord A-001)。対応表が決まったらこの 1 箇所だけを直す。
 */
const LOAN_PERIOD_TABLE: Readonly<Record<PatronCategory, Readonly<Record<MediaType, LoanPeriodDays>>>> = {
  general: { paper: 14, electronic: 14 },
  child: { paper: 14, electronic: 14 },
  student: { paper: 14, electronic: 14 },
};

export function determineLoanPeriod(category: PatronCategory, mediaType: MediaType): LoanPeriodDays {
  return LOAN_PERIOD_TABLE[category][mediaType];
}
