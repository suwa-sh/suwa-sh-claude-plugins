/**
 * 要求本文と Idempotency-Key ヘッダの入力検証で共通に使う部品 (契約 components/schemas と parameters/IdempotencyKey)。
 */
import type { FieldError } from '../../../../packages/contracts/library-api/types';

/** 契約 parameters/IdempotencyKey の minLength / maxLength */
const IDEMPOTENCY_KEY_MIN_LENGTH = 1;
const IDEMPOTENCY_KEY_MAX_LENGTH = 128;
/** 契約 BookId の format: uuid (RFC 9562 の文字列表現) */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Validated<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 本文が JSON オブジェクトでないときのエラー */
export const NOT_AN_OBJECT: FieldError = {
  field: 'body',
  message: '要求本文は JSON オブジェクトで指定してください',
};

export function validateBookId(value: unknown): FieldError | null {
  if (value === undefined) {
    return { field: 'bookId', message: '書籍IDは必須です' };
  }
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    return { field: 'bookId', message: '書籍IDは UUID 形式で指定してください' };
  }
  return null;
}

/** 契約で additionalProperties: false の要求に、定義されていない項目があればエラーにする */
export function unknownFieldErrors(
  body: Record<string, unknown>,
  allowed: ReadonlySet<string>,
): FieldError[] {
  return Object.keys(body)
    .filter((field) => !allowed.has(field))
    .map((field) => ({ field, message: `${field} は指定できない項目です` }));
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
