/**
 * 貸出登録の永続化ポート (circulation モジュール)。実装は repository 層。
 * 蔵書と貸出・予約の状態をまたぐ更新は 1 トランザクションで行う (ADR 0009)。
 */
import type { LendableCopy, LoanRegistration } from './loan';
import type { LoanRule } from './loanRule';

export interface LoanRegistrationSession {
  findLendableCopy(copyId: string): Promise<LendableCopy | null>;
  findEffectiveLoanRule(loanedOn: string): Promise<LoanRule | null>;
  /** 貸出・蔵書・予約の events 追記と snapshots 反映。楽観ロックに負けたら ConcurrentUpdateError */
  save(registration: LoanRegistration, occurredAt: string): Promise<void>;
}

export interface LoanRepository {
  /** fn を 1 トランザクションで実行する。fn が投げたら rollback する */
  inTransaction<T>(fn: (session: LoanRegistrationSession) => Promise<T>): Promise<T>;
}

/** 楽観ロックの競合 (同じ蔵書・予約が並行して更新された)。 */
export class ConcurrentUpdateError extends Error {
  constructor(readonly target: string) {
    super(`並行する更新と競合しました: ${target}`);
    this.name = 'ConcurrentUpdateError';
  }
}
