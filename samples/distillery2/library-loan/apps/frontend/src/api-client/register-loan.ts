/**
 * 貸出を登録する API (library-api の registerLoan) の呼び出し口。
 *
 * URL・型は生成クライアント `packages/contracts/library-api/client.ts` に任せ、ここでは
 * 契約が必須とする Idempotency-Key ヘッダ (ADR 0005) を付けることと、fetch の注入口を用意することだけを担う。
 */
import {
  type ClientOptions,
  type RegisterLoanResult,
  registerLoan,
} from '../../../../packages/contracts/library-api/client';
import type { RegisterLoanRequest } from '../../../../packages/contracts/library-api/types';

/** 契約 components.parameters.IdempotencyKey のヘッダ名 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

export interface RegisterLoanCallOptions {
  /** 生成クライアントに渡す fetch。UC BDD やテストが差し替える */
  fetch?: typeof fetch;
  /** API のベース URL。既定は同一オリジン */
  baseUrl?: string;
  /** 追加ヘッダ (認可トークン等) */
  headers?: Record<string, string>;
  /** 再送判定キー。同じ登録操作の再送では同じ値を渡す */
  idempotencyKey: string;
}

export async function callRegisterLoan(
  body: RegisterLoanRequest,
  options: RegisterLoanCallOptions,
): Promise<RegisterLoanResult> {
  const clientOptions: ClientOptions = {
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    headers: { ...(options.headers ?? {}), [IDEMPOTENCY_KEY_HEADER]: options.idempotencyKey },
  };
  return registerLoan({ body }, clientOptions);
}
