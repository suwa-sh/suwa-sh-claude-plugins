/**
 * 貸出受付画面の「貸出する」操作。入力を createLoan に送り、結果から画面状態を返す。
 */
import type { LoanApi } from '../../api-client/loan-api';
import { toLoanCheckoutView, type LoanCheckoutInput, type LoanCheckoutView } from './loan-checkout-state';

/** バーコードリーダー入力の前後の空白を落とす。形式の検証は契約どおりサーバ (400) に任せる */
function normalizeInput(input: LoanCheckoutInput): LoanCheckoutInput {
  return { patronNumber: input.patronNumber.trim(), bookId: input.bookId.trim() };
}

export async function submitLoanCheckout(api: LoanApi, input: LoanCheckoutInput): Promise<LoanCheckoutView> {
  const normalized = normalizeInput(input);
  const result = await api.createLoan(normalized);
  return toLoanCheckoutView(normalized, result);
}
