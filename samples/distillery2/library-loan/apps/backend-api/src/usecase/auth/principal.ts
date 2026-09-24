/**
 * 認証済みの操作者。アクセストークンのクレームから取り出したロールと利用者番号 (ADR 0006)。
 * 認可判定 (ロールと本人確認) は usecase 層で行う。
 */
export type Principal =
  | { role: 'staff'; subject: string }
  | { role: 'patron'; subject: string; patronNumber: string };

/** ロールによる認可で拒否された。 */
export class ForbiddenError extends Error {
  constructor(message = 'この操作を行う権限がありません') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
