/**
 * RFC 9457 Problem Details (契約 components/schemas/Problem, ValidationProblem)。
 * type / title は契約の共通レスポンス (BadRequest / Unauthorized / Forbidden / NotFound / Conflict) と createLoan の例に合わせる。
 */
export interface FieldError {
  field: string;
  message: string;
}

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  errors?: FieldError[];
}

const PROBLEM_BASE = 'https://library.example/problems';

export function validationProblem(errors: FieldError[]): Problem {
  return {
    type: `${PROBLEM_BASE}/validation-error`,
    title: '入力内容に誤りがあります',
    status: 400,
    detail: '入力項目を確認してください',
    errors,
  };
}

export function unauthorizedProblem(): Problem {
  return { type: `${PROBLEM_BASE}/unauthorized`, title: 'ログインが必要です', status: 401 };
}

export function forbiddenProblem(): Problem {
  return { type: `${PROBLEM_BASE}/forbidden`, title: 'この操作を行う権限がありません', status: 403 };
}

export function notFoundProblem(code: string | undefined, detail: string | undefined): Problem {
  return {
    type: `${PROBLEM_BASE}/not-found`,
    title: '対象が見つかりません',
    status: 404,
    ...(code ? { code } : {}),
    ...(detail ? { detail } : {}),
  };
}

export function loanNotAllowedProblem(code: string, title: string, detail: string): Problem {
  return { type: `${PROBLEM_BASE}/loan-not-allowed`, title, status: 409, code, detail };
}

export function conflictProblem(code: string, detail: string): Problem {
  return { type: `${PROBLEM_BASE}/conflict`, title: '他の操作と競合しました', status: 409, code, detail };
}

/** 想定外の失敗 (AssumptionRecord A-008)。内部の詳細は返さない。 */
export function internalErrorProblem(): Problem {
  return {
    type: `${PROBLEM_BASE}/internal-error`,
    title: 'サーバでエラーが発生しました',
    status: 500,
    detail: '時間をおいてもう一度お試しください',
  };
}
