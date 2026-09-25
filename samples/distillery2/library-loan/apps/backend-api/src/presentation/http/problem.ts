/**
 * エラー応答 (RFC 9457 Problem Details)。契約 components.schemas.Problem の形で返す。
 * type の URI と title は契約 examples に揃える。
 */
import type { FieldError, Problem } from '../../../../../packages/contracts/api/types';

const PROBLEM_BASE = 'https://library.example/problems';

export interface HttpResponse {
  status: number;
  body: unknown;
  contentType: 'application/json' | 'application/problem+json';
}

export function json(status: number, body: unknown): HttpResponse {
  return { status, body, contentType: 'application/json' };
}

export function problem(p: Problem): HttpResponse {
  return { status: p.status, body: p, contentType: 'application/problem+json' };
}

export function validationProblem(errors: FieldError[]): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/validation-error`,
    title: '入力内容に誤りがあります',
    status: 400,
    errors,
  });
}

export function notFoundProblem(code: string, title: string): HttpResponse {
  return problem({ type: `${PROBLEM_BASE}/not-found`, title, status: 404, code });
}

export function businessRuleProblem(code: string, title: string, detail: string): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/business-rule-violation`,
    title,
    status: 409,
    code,
    detail,
  });
}

export function unauthorizedProblem(): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/unauthorized`,
    title: 'ログインが必要です',
    status: 401,
    code: 'unauthorized',
  });
}

export function forbiddenProblem(): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/forbidden`,
    title: 'この操作を行う権限がありません',
    status: 403,
    code: 'forbidden',
  });
}

export function conflictProblem(): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/conflict`,
    title: '他の操作と競合しました',
    status: 409,
    code: 'concurrent_update',
    detail: '時間をおいてもう一度お試しください。',
  });
}

export function internalErrorProblem(): HttpResponse {
  return problem({
    type: `${PROBLEM_BASE}/internal-error`,
    title: 'システムエラーが発生しました',
    status: 500,
    code: 'internal_error',
  });
}
