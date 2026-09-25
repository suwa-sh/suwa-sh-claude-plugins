/**
 * 貸出 API の呼び出し (api-client 層)。
 * URL・型は生成クライアント packages/contracts/api/client.ts に任せ、ここでは手書きしない。
 */
import {
  type ClientOptions,
  type CreateLoanResult,
  createLoan,
} from '../../../../packages/contracts/api/client';

/** 契約 openapi.yaml の servers[0].url (backend-api のベースパス)。 */
export const API_BASE_URL = '/api';

/** 画面の入口関数に上位から注入する API 呼び出しの設定。 */
export interface ApiOptions {
  /** 差し替え可能な fetch。UC BDD はここに計装つき fetch を渡す。 */
  fetch?: typeof fetch;
  /** ベース URL。既定は契約の servers (`/api`)。 */
  baseUrl?: string;
  /** 追加ヘッダ (認可トークン等)。トークンの取得は上位 (認証基盤の結線) が担う。 */
  headers?: Record<string, string>;
}

/** 貸出受付の入力 (利用者番号 + 蔵書 ID)。 */
export interface LoanCheckoutInput {
  patronNumber: string;
  copyId: string;
}

/** 貸出を登録する (createLoan)。応答はステータスごとの判別共用体で返す。 */
export function registerLoan(
  input: LoanCheckoutInput,
  options: ApiOptions = {},
): Promise<CreateLoanResult> {
  const clientOptions: ClientOptions = {
    baseUrl: options.baseUrl ?? API_BASE_URL,
    fetch: options.fetch,
    headers: options.headers,
  };
  return createLoan(
    { body: { patron_number: input.patronNumber, copy_id: input.copyId } },
    clientOptions,
  );
}
