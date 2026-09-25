/**
 * 認証済みの操作主体。利用者区分 (UserRole) ごとに、認可判定に使う識別子を持つ (ADR 0006)。
 */
export type Principal =
  | { role: 'librarian'; librarianId: string }
  | { role: 'patron'; patronNumber: string };

/** 利用者区分により操作が許可されない (認可は usecase 層で判定する: ADR 0006)。 */
export class ForbiddenError extends Error {
  constructor(readonly operation: string) {
    super(`この操作は許可されていません: ${operation}`);
    this.name = 'ForbiddenError';
  }
}

/** 指定された対象が存在しない。code は契約 Problem.code の値。 */
export class NotFoundError extends Error {
  constructor(readonly code: 'patron_not_found' | 'copy_not_found') {
    super(code);
    this.name = 'NotFoundError';
  }
}

export function requireLibrarian(
  principal: Principal,
  operation: string,
): { role: 'librarian'; librarianId: string } {
  if (principal.role !== 'librarian') throw new ForbiddenError(operation);
  return principal;
}
