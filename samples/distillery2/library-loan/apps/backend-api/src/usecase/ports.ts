/**
 * usecase が定義するポート (ADR 0003)。repository / gateway の実装はこの形に構造的に合わせる
 * (repository / gateway から usecase への import はアーキテストで禁止されているため)。
 */
import type {
  BookStatus,
  Loan,
  ReservationStatus,
  Role,
} from '../../../../packages/contracts/library-api/types';

/** 認証済みの主体。OIDC のアクセストークンのクレームから作る (ADR 0006) */
export type Principal = {
  /** IdP の subject */
  subject: string;
  role: Role;
  /** patron ロールのときの本人の利用者番号 */
  patronNumber?: string;
};

/** アクセストークンを検証して主体を返す (IdP の gateway)。検証できなければ null */
export interface TokenVerifier {
  verify(token: string): Promise<Principal | null>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  newId(): string;
}

/** 更新を 1 トランザクションにまとめる。fn の中の repository 呼び出しは同じトランザクションで動く */
export interface UnitOfWork {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

/** 追記するイベントの共通情報 */
export type EventContext = {
  /** 操作した主体 (IdP の subject) */
  actorSubject: string;
  occurredAt: Date;
};

export type BookSnapshot = {
  bookId: string;
  status: BookStatus;
  /** スナップショットの版 (楽観ロック) */
  version: number;
};

export interface BookRepository {
  /** 論理削除されていない書籍を、更新のためにロックして取得する */
  findForUpdate(bookId: string): Promise<BookSnapshot | null>;
  /** 書籍を貸出中にし、書籍イベントを追記する */
  markOnLoan(book: BookSnapshot, loanId: string, context: EventContext): Promise<void>;
}

export type PatronRecord = {
  patronNumber: string;
  /** 削除日。値があれば論理削除済み */
  deletedOn: string | null;
};

export interface PatronRepository {
  findByPatronNumber(patronNumber: string): Promise<PatronRecord | null>;
}

export type ReservationSnapshot = {
  reservationId: string;
  patronNumber: string;
  status: ReservationStatus;
  queuePosition: number;
  version: number;
};

export interface ReservationRepository {
  /** 書籍の予約順位の管理対象 (予約中・通知済) のうち、予約順位が最も小さい予約をロックして取得する */
  findFirstInQueueForUpdate(bookId: string): Promise<ReservationSnapshot | null>;
  /** 予約を完了にし、予約イベントを追記する */
  complete(reservation: ReservationSnapshot, loanId: string, context: EventContext): Promise<void>;
}

export interface LoanRepository {
  /** 貸出を記録し、貸出イベントを追記する */
  register(loan: Loan, context: EventContext): Promise<void>;
}

/** 返却を登録する UC が使う書籍の操作 */
export interface BookReturnRepository {
  /** 論理削除されていない書籍を、更新のためにロックして取得する */
  findForUpdate(bookId: string): Promise<BookSnapshot | null>;
  /** 返却後の書籍状態 (在庫あり・予約待ち) にし、書籍イベントを追記する */
  markReturned(
    book: BookSnapshot,
    status: Extract<BookStatus, 'available' | 'awaiting_pickup'>,
    loanId: string,
    context: EventContext,
  ): Promise<void>;
}

/** 貸出のスナップショット (契約 Loan と楽観ロックの版) */
export type LoanSnapshot = Loan & { version: number };

/** 返却を登録する UC が使う貸出の操作 */
export interface LoanReturnRepository {
  /** 書籍の未返却の貸出 (貸出中・延滞) を、更新のためにロックして取得する */
  findUnreturnedByBookForUpdate(bookId: string): Promise<LoanSnapshot | null>;
  /** 貸出を返却済にして返却日を記録し、貸出イベントを追記する */
  markReturned(loan: LoanSnapshot, returnedOn: string, context: EventContext): Promise<void>;
}

/** 返却を登録する UC が使う予約の参照 */
export interface WaitingReservationReader {
  /** 書籍に予約中 (waiting) の予約があるか */
  hasWaiting(bookId: string): Promise<boolean>;
}

/** Idempotency-Key の適用範囲 (契約 idempotency_keys の主キー) */
export type IdempotencyScope = {
  idempotencyKey: string;
  principalSubject: string;
  operationId: string;
};

export type StoredResponse = {
  requestHash: string;
  responseStatus: number;
  responseBody: string | null;
};

export interface IdempotencyRepository {
  find(scope: IdempotencyScope): Promise<StoredResponse | null>;
  save(scope: IdempotencyScope, response: StoredResponse, createdAt: Date): Promise<void>;
}
