/**
 * 貸出 API クライアント (operationId: createLoan)。
 *
 * frontend ルールは「API 呼び出しは packages/contracts の生成クライアント経由」だが、生成クライアントがまだ無い
 * (issue: .distillery/runs/register-loan/issues/20260924_130000_frontend-api-client-missing.md)。
 * そのため HTTP の送受信は注入された ApiTransport に任せ、ここでは fetch を直接呼ばない。
 * 生成クライアントが用意されたら、ApiTransport の実装をそれに差し替える。
 */
import type { CreateLoanRequest, Loan, Problem } from './loan-api-types';

/** 契約の servers[0].url。フロントと同一オリジンから相対パスで呼ぶ */
export const API_BASE_PATH = '/api/v1';
/** 契約 paths の貸出登録 */
export const CREATE_LOAN_PATH = `${API_BASE_PATH}/loans`;

export interface ApiRequest {
  method: 'POST';
  path: string;
  body: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** HTTP 送受信の境界。通信そのものに失敗したときは例外を投げる */
export type ApiTransport = (request: ApiRequest) => Promise<ApiResponse>;

export type CreateLoanResult =
  | { kind: 'created'; status: 201; loan: Loan }
  | { kind: 'problem'; status: number; problem: Problem | null }
  | { kind: 'network-error' };

export interface LoanApi {
  createLoan(request: CreateLoanRequest): Promise<CreateLoanResult>;
}

const HTTP_CREATED = 201;

function isProblem(body: unknown): body is Problem {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return typeof candidate['title'] === 'string' && typeof candidate['status'] === 'number';
}

export function createLoanApi(transport: ApiTransport): LoanApi {
  return {
    async createLoan(request) {
      let response: ApiResponse;
      try {
        response = await transport({ method: 'POST', path: CREATE_LOAN_PATH, body: request });
      } catch {
        return { kind: 'network-error' };
      }
      if (response.status === HTTP_CREATED) {
        return { kind: 'created', status: HTTP_CREATED, loan: response.body as Loan };
      }
      return {
        kind: 'problem',
        status: response.status,
        problem: isProblem(response.body) ? response.body : null,
      };
    },
  };
}
