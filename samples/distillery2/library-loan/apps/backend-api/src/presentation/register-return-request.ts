/**
 * 返却の登録要求 (契約 components/schemas/RegisterReturnRequest) の入力検証。
 */
import type {
  FieldError,
  RegisterReturnRequest,
} from '../../../../packages/contracts/library-api/types';
import {
  isRecord,
  NOT_AN_OBJECT,
  unknownFieldErrors,
  type Validated,
  validateBookId,
} from './request-validation';

const ALLOWED_FIELDS: ReadonlySet<string> = new Set(['bookId']);

export function validateRegisterReturnRequest(body: unknown): Validated<RegisterReturnRequest> {
  if (!isRecord(body)) {
    return { ok: false, errors: [NOT_AN_OBJECT] };
  }
  const errors: FieldError[] = [];
  const bookIdError = validateBookId(body.bookId);
  if (bookIdError) {
    errors.push(bookIdError);
  }
  errors.push(...unknownFieldErrors(body, ALLOWED_FIELDS));
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { bookId: body.bookId as string } };
}
