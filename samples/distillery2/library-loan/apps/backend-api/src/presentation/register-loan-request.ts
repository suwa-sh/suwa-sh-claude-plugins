/**
 * 貸出の登録要求 (契約 components/schemas/RegisterLoanRequest) の入力検証。
 */
import type {
  FieldError,
  RegisterLoanRequest,
} from '../../../../packages/contracts/library-api/types';
import {
  isRecord,
  NOT_AN_OBJECT,
  unknownFieldErrors,
  type Validated,
  validateBookId,
} from './request-validation';

/** 契約 PatronNumber の minLength / maxLength */
const PATRON_NUMBER_MIN_LENGTH = 1;
const PATRON_NUMBER_MAX_LENGTH = 32;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set(['patronNumber', 'bookId']);

function validatePatronNumber(value: unknown): FieldError | null {
  if (value === undefined) {
    return { field: 'patronNumber', message: '利用者番号は必須です' };
  }
  if (
    typeof value !== 'string' ||
    value.length < PATRON_NUMBER_MIN_LENGTH ||
    value.length > PATRON_NUMBER_MAX_LENGTH
  ) {
    return {
      field: 'patronNumber',
      message: `利用者番号は ${PATRON_NUMBER_MIN_LENGTH}〜${PATRON_NUMBER_MAX_LENGTH} 文字の文字列で指定してください`,
    };
  }
  return null;
}

export function validateRegisterLoanRequest(body: unknown): Validated<RegisterLoanRequest> {
  if (!isRecord(body)) {
    return { ok: false, errors: [NOT_AN_OBJECT] };
  }
  const errors: FieldError[] = [];
  const patronNumberError = validatePatronNumber(body.patronNumber);
  if (patronNumberError) {
    errors.push(patronNumberError);
  }
  const bookIdError = validateBookId(body.bookId);
  if (bookIdError) {
    errors.push(bookIdError);
  }
  errors.push(...unknownFieldErrors(body, ALLOWED_FIELDS));
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { patronNumber: body.patronNumber as string, bookId: body.bookId as string },
  };
}
