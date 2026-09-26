/**
 * 貸出の登録要求 (契約 components/schemas/RegisterLoanRequest) と Idempotency-Key ヘッダの入力検証。
 */
import type {
  FieldError,
  RegisterLoanRequest,
} from '../../../../packages/contracts/library-api/types';

/** 契約 PatronNumber の minLength / maxLength */
const PATRON_NUMBER_MIN_LENGTH = 1;
const PATRON_NUMBER_MAX_LENGTH = 32;
/** 契約 parameters/IdempotencyKey の minLength / maxLength */
const IDEMPOTENCY_KEY_MIN_LENGTH = 1;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
/** 契約 BookId の format: uuid (RFC 9562 の文字列表現) */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = new Set(['patronNumber', 'bookId']);

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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

function validateBookId(value: unknown): FieldError | null {
  if (value === undefined) {
    return { field: 'bookId', message: '書籍IDは必須です' };
  }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    return { field: 'bookId', message: '書籍IDは UUID 形式で指定してください' };
  }
  return null;
}

export function validateRegisterLoanRequest(body: unknown): Validated<RegisterLoanRequest> {
  if (!isRecord(body)) {
    return {
      ok: false,
      errors: [{ field: 'body', message: '要求本文は JSON オブジェクトで指定してください' }],
    };
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
  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push({ field, message: `${field} は指定できない項目です` });
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: { patronNumber: body.patronNumber as string, bookId: body.bookId as string },
  };
}

export function validateIdempotencyKey(value: string | string[] | undefined): Validated<string> {
  if (value === undefined || Array.isArray(value)) {
    return {
      ok: false,
      errors: [{ field: 'Idempotency-Key', message: 'Idempotency-Key ヘッダは必須です' }],
    };
  }
  if (value.length < IDEMPOTENCY_KEY_MIN_LENGTH || value.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    return {
      ok: false,
      errors: [
        {
          field: 'Idempotency-Key',
          message: `Idempotency-Key ヘッダは ${IDEMPOTENCY_KEY_MIN_LENGTH}〜${IDEMPOTENCY_KEY_MAX_LENGTH} 文字で指定してください`,
        },
      ],
    };
  }
  return { ok: true, value };
}
