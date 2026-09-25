/**
 * operationId: createLoan (POST /loans) のハンドラ。
 * 入力検証 (契約 CreateLoanRequest) → usecase RegisterLoan → 契約 Loan / Problem への変換だけを担う。
 */
import type {
  CreateLoanRequest,
  FieldError,
  Loan,
} from '../../../../../packages/contracts/api/types';
import {
  LoanNotAllowedError,
  type LoanRefusalReason,
} from '../../domain/circulation/loanEligibility';
import { ConcurrentUpdateError } from '../../domain/circulation/loanRepository';
import type { RegisterLoan, RegisterLoanResult } from '../../usecase/circulation/registerLoan';
import { ForbiddenError, NotFoundError, type Principal } from '../../usecase/shared/principal';
import {
  businessRuleProblem,
  conflictProblem,
  forbiddenProblem,
  type HttpResponse,
  json,
  notFoundProblem,
  validationProblem,
} from '../http/problem';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = new Set(['patron_number', 'copy_id']);

/** 契約 409 examples の detail に揃えた、貸し出せない理由の説明 */
const REFUSAL_DETAIL: Record<LoanRefusalReason, string> = {
  on_loan: 'この蔵書は貸出中です。',
  held_for_other: 'この蔵書は他の利用者向けに取り置き中です。',
  withdrawn: 'この蔵書は除籍済みです。',
};

const NOT_FOUND_TITLE: Record<NotFoundError['code'], string> = {
  patron_not_found: '利用者が見つかりません',
  copy_not_found: '蔵書が見つかりません',
};

function isBlank(value: unknown): boolean {
  return (
    value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
  );
}

export function validateCreateLoanRequest(
  body: unknown,
): { ok: true; value: CreateLoanRequest } | { ok: false; errors: FieldError[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      errors: [
        { field: 'body', code: 'format', message: '入力内容を JSON オブジェクトで送ってください' },
      ],
    };
  }
  const input = body as Record<string, unknown>;
  const errors: FieldError[] = [];

  if (isBlank(input.patron_number)) {
    errors.push({ field: 'patron_number', code: 'required', message: '利用者番号は必須です' });
  } else if (typeof input.patron_number !== 'string') {
    errors.push({
      field: 'patron_number',
      code: 'format',
      message: '利用者番号の形式が正しくありません',
    });
  }

  if (isBlank(input.copy_id)) {
    errors.push({ field: 'copy_id', code: 'required', message: '蔵書 ID は必須です' });
  } else if (typeof input.copy_id !== 'string' || !UUID_PATTERN.test(input.copy_id)) {
    errors.push({ field: 'copy_id', code: 'format', message: '蔵書 ID の形式が正しくありません' });
  }

  for (const field of Object.keys(input)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push({ field, code: 'unknown_field', message: `受け付けない項目です: ${field}` });
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { patron_number: input.patron_number as string, copy_id: input.copy_id as string },
  };
}

export function toLoanResponse(result: RegisterLoanResult): Loan {
  const { loan } = result;
  return {
    loan_id: loan.loanId,
    patron_number: loan.patronNumber,
    copy_id: loan.copyId,
    book_title: loan.bookTitle,
    loaned_on: loan.loanedOn,
    due_on: loan.dueOn,
    returned_on: loan.returnedOn,
    status: loan.status,
    copy_status: result.copyStatus,
    fulfilled_reservation_id: result.fulfilledReservationId,
  };
}

export function createLoanHandler(registerLoan: RegisterLoan) {
  return async (principal: Principal, body: unknown): Promise<HttpResponse> => {
    const validated = validateCreateLoanRequest(body);
    if (!validated.ok) return validationProblem(validated.errors);

    try {
      const result = await registerLoan.execute(principal, {
        patronNumber: validated.value.patron_number,
        copyId: validated.value.copy_id,
      });
      return json(201, toLoanResponse(result));
    } catch (error) {
      if (error instanceof ForbiddenError) return forbiddenProblem();
      if (error instanceof NotFoundError) {
        return notFoundProblem(error.code, NOT_FOUND_TITLE[error.code]);
      }
      if (error instanceof LoanNotAllowedError) {
        return businessRuleProblem(
          'loan_not_allowed',
          '貸し出せません',
          REFUSAL_DETAIL[error.reason],
        );
      }
      if (error instanceof ConcurrentUpdateError) return conflictProblem();
      throw error;
    }
  };
}
