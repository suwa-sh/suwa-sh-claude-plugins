/**
 * 返却を登録する API (library-api の registerReturn) の呼び出し口。
 *
 * URL・型は生成クライアント `packages/contracts/library-api/client.ts` に任せ、ここでは
 * 契約が必須とする Idempotency-Key ヘッダ (ADR 0005) を付けることと、fetch の注入口を用意することだけを担う。
 */
import {
  type ClientOptions,
  type RegisterReturnResult,
  registerReturn,
} from '../../../../packages/contracts/library-api/client';
import type { RegisterReturnRequest } from '../../../../packages/contracts/library-api/types';
import { IDEMPOTENCY_KEY_HEADER } from './register-loan';

export interface RegisterReturnCallOptions {
  /** 生成クライアントに渡す fetch。UC BDD やテストが差し替える */
  fetch?: typeof fetch;
  /** API のベース URL。既定は同一オリジン */
  baseUrl?: string;
  /** 追加ヘッダ (認可トークン等) */
  headers?: Record<string, string>;
  /** 再送判定キー。同じ登録操作の再送では同じ値を渡す */
  idempotencyKey: string;
}

export async function callRegisterReturn(
  body: RegisterReturnRequest,
  options: RegisterReturnCallOptions,
): Promise<RegisterReturnResult> {
  const clientOptions: ClientOptions = {
    baseUrl: options.baseUrl,
    fetch: options.fetch,
    headers: { ...(options.headers ?? {}), [IDEMPOTENCY_KEY_HEADER]: options.idempotencyKey },
  };
  return registerReturn({ body }, clientOptions);
}
