import type { FieldError } from '../problem';

/**
 * 契約 CreateLoanRequest (additionalProperties: false, required: patronNumber, bookId)。
 * PatronNumber は ^P[0-9]{6}$、BookId は uuid 形式。
 */
export interface CreateLoanRequest {
  patronNumber: string;
  bookId: string;
}

const PATRON_NUMBER_PATTERN = /^P[0-9]{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_FIELDS = new Set(['patronNumber', 'bookId']);

export type ParseResult = { ok: true; value: CreateLoanRequest } | { ok: false; errors: FieldError[] };

export function parseCreateLoanRequest(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, errors: [{ field: 'body', message: 'リクエスト本文は JSON オブジェクトで指定してください' }] };
  }
  const record = body as Record<string, unknown>;
  const errors: FieldError[] = [];

  const patronNumber = record['patronNumber'];
  if (patronNumber === undefined || patronNumber === null || patronNumber === '') {
    errors.push({ field: 'patronNumber', message: '利用者番号は必須です' });
  } else if (typeof patronNumber !== 'string' || !PATRON_NUMBER_PATTERN.test(patronNumber)) {
    errors.push({ field: 'patronNumber', message: '利用者番号は P に続く 6 桁の数字で指定してください' });
  }

  const bookId = record['bookId'];
  if (bookId === undefined || bookId === null || bookId === '') {
    errors.push({ field: 'bookId', message: '書籍IDは必須です' });
  } else if (typeof bookId !== 'string' || !UUID_PATTERN.test(bookId)) {
    errors.push({ field: 'bookId', message: '書籍IDの形式が正しくありません' });
  }

  for (const key of Object.keys(record)) {
    if (!ALLOWED_FIELDS.has(key)) errors.push({ field: key, message: 'この項目は指定できません' });
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { patronNumber: patronNumber as string, bookId: bookId as string } };
}
