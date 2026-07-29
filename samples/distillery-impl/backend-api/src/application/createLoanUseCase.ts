import { randomUUID } from "node:crypto";
import { calculateDueDate, canLend } from "../domain/loan";
import type { Clock } from "../ports/clock";
import type { IdempotencyStore } from "../ports/idempotencyStore";
import type { BookRepository } from "../repositories/bookRepository";
import {
  type Loan,
  type LoanRepository,
  UniqueConstraintViolationError,
} from "../repositories/loanRepository";
import type { ReservationRepository } from "../repositories/reservationRepository";
import { ConflictError, NotFoundError, ValidationError } from "./errors";

export interface CreateLoanCommand {
  bookId: string;
  userId: string;
  idempotencyKey: string;
}

export interface CreateLoanResult {
  id: string;
  bookId: string;
  bookTitle: string;
  userId: string;
  loanDate: Date;
  dueDate: Date;
}

export interface CreateLoanUseCaseDeps {
  bookRepository: BookRepository;
  loanRepository: LoanRepository;
  reservationRepository: ReservationRepository;
  idempotencyStore: IdempotencyStore;
  clock: Clock;
}

export function createLoanUseCase(deps: CreateLoanUseCaseDeps) {
  return function execute(command: CreateLoanCommand): CreateLoanResult {
    if (!command.bookId) {
      throw new ValidationError("book_idは必須です");
    }
    if (!command.idempotencyKey) {
      throw new ValidationError("X-Idempotency-Keyヘッダは必須です");
    }

    // 出典: tier-backend-api.md ビジネスルール「冪等キーは KVS で重複チェック後、RDB の UNIQUE 制約で二重防止」
    if (deps.idempotencyStore.has(command.idempotencyKey)) {
      throw new ConflictError("このリクエストは既に処理済みです");
    }

    const book = deps.bookRepository.findById(command.bookId);
    if (!book) {
      throw new NotFoundError("書籍が見つかりません");
    }

    // 出典: tier-backend-api.md ビジネスルール「貸出可否判定ルール」
    // 予約情報は reservations テーブル(ReservationRepository)経由で取得する
    const activeReservations = deps.reservationRepository.findActiveByBookId(
      command.bookId,
    );
    if (!canLend(book, command.userId, activeReservations)) {
      throw new ConflictError("この書籍は現在貸出できません");
    }

    const loanDate = deps.clock.today();
    const dueDate = calculateDueDate(loanDate);

    const loan: Loan = {
      id: randomUUID(),
      bookId: book.id,
      userId: command.userId,
      loanDate,
      dueDate,
      returnDate: null,
      isOverdue: false,
      idempotencyKey: command.idempotencyKey,
      createdAt: new Date(),
    };

    // 出典: tier-backend-api.md ビジネスルール「貸出と書籍状態更新は同一トランザクション内で実行」
    // in-memory リポジトリは同期実行のため、この 2 操作の間に他の非同期処理を挟まないことで
    // 単一トランザクション相当の原子性を保つ。
    try {
      deps.loanRepository.create(loan);
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        // 出典: tier-backend-api.md エラーレスポンス表 409 冪等キー重複。
        // KVS(idempotencyStore.has)の事前チェックをすり抜けた重複が、RDB UNIQUE 制約相当の
        // この経路で検出された場合も、同じ 409 レスポンスにマッピングする
        // (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-003)。
        throw new ConflictError("このリクエストは既に処理済みです");
      }
      throw error;
    }
    deps.bookRepository.updateStatus(book.id, "on_loan");
    deps.idempotencyStore.put(command.idempotencyKey);

    // 出典: spec.md 状態遷移一覧「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」。
    // 予約確保済(reserved)の予約者本人が貸出した場合のみ該当予約を完了(fulfilled)化する。
    // 通常貸出(対象書籍に予約が存在しない)の場合はリポジトリ側で該当なし=no-opとなる。
    deps.reservationRepository.completeReservedByBookIdAndUserId(
      book.id,
      command.userId,
    );

    return {
      id: loan.id,
      bookId: loan.bookId,
      bookTitle: book.title,
      userId: loan.userId,
      loanDate: loan.loanDate,
      dueDate: loan.dueDate,
    };
  };
}
