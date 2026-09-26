/**
 * 貸出の運用値。要求 (docs/requirements) と契約に値が無いため、実装で仮置きしている。
 * 変更するときは AssumptionRecord (.distillery/runs/register-loan/attempt-1/assumptions.backend-api.yaml) も直す。
 */

/** 貸出期間の日数 (返却期限算出条件の「貸出期間」)。AssumptionRecord A-001。契約 example の dueDate (貸出日 + 14 日) に合わせた */
export const LOAN_PERIOD_DAYS = 14;

/** 貸出日を決めるタイムゾーン (契約「貸出日はサーバーの当日の日付」の「当日」)。AssumptionRecord A-002 */
export const LIBRARY_TIME_ZONE = 'Asia/Tokyo';
