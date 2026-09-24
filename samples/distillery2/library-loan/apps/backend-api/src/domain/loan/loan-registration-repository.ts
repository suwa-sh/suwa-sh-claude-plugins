import type { LendingContext, LoanRegistration } from './loan';

/** 貸出登録の永続化ポート。実装は repository 層 (ADR 0003)。 */
export interface LoanRegistrationRepository {
  /** 貸出可否の判定に必要な書籍・利用者・取置中の予約を読む。 */
  loadLendingContext(bookId: string, patronNumber: string): Promise<LendingContext>;
  /**
   * 貸出を記録する。イベントの追記とスナップショットの更新を 1 トランザクションで行う (ADR 0004)。
   * 書籍の版番号が expectedBookVersion と異なれば VersionConflict を投げ、何も書かない。
   */
  save(registration: LoanRegistration, actorId: string, occurredAt: Date): Promise<void>;
}
