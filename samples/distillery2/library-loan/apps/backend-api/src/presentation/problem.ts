/** RFC 9457 Problem Details (契約 components/schemas/Problem) の組み立て */
import type {
  FieldError,
  Problem,
  ProblemCode,
} from '../../../../packages/contracts/library-api/types';

const PROBLEM_TYPE_BASE = 'https://library.example/problems/';

type ProblemDefinition = { status: number; title: string };

/** 利用者に表示できる文言。409 の 3 種と 400 は契約の example と同じ文言 */
const DEFINITIONS: Record<ProblemCode, ProblemDefinition> = {
  validation_error: { status: 400, title: '入力内容に誤りがあります' },
  unauthorized: { status: 401, title: 'ログインが必要です' },
  forbidden: { status: 403, title: 'この操作を行う権限がありません' },
  not_found: { status: 404, title: '指定したものが見つかりません' },
  business_rule_violation: { status: 409, title: '業務ルールにより処理できません' },
  idempotency_key_conflict: {
    status: 409,
    title: '同じ Idempotency-Key で異なる内容の要求が送られました',
  },
  internal_error: { status: 500, title: 'システムエラーが発生しました' },
  book_on_loan: { status: 409, title: 'この書籍は貸出中のため貸し出せません' },
  not_first_in_reservation_queue: {
    status: 409,
    title: 'この書籍は予約順 1 位の利用者にだけ貸し出せます',
  },
  patron_not_registered: { status: 409, title: '登録されていない利用者には貸し出せません' },
};

export function problem(
  code: ProblemCode,
  options: { detail?: string; errors?: FieldError[] } = {},
): Problem {
  const definition = DEFINITIONS[code];
  const result: Problem = {
    type: `${PROBLEM_TYPE_BASE}${code.replaceAll('_', '-')}`,
    title: definition.title,
    status: definition.status,
    code,
  };
  if (options.detail !== undefined) {
    result.detail = options.detail;
  }
  if (options.errors !== undefined) {
    result.errors = options.errors;
  }
  return result;
}
