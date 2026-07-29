import { describe, expect, it } from "vitest";
import { createLoanUseCase } from "../src/application/createLoanUseCase";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../src/application/errors";
import { FixedClock } from "../src/ports/clock";
import { InMemoryIdempotencyStore } from "../src/ports/idempotencyStore";
import { InMemoryBookRepository } from "../src/repositories/bookRepository";
import {
  InMemoryLoanRepository,
  type Loan,
  type LoanRepository,
  UniqueConstraintViolationError,
} from "../src/repositories/loanRepository";
import { InMemoryReservationRepository } from "../src/repositories/reservationRepository";

// 出典: tier-backend-api.md API仕様「貸出作成 API」/ エラーレスポンス表

const TODAY = new Date(Date.UTC(2026, 3, 12));

function setup() {
  const bookRepository = new InMemoryBookRepository();
  const loanRepository = new InMemoryLoanRepository();
  const reservationRepository = new InMemoryReservationRepository();
  const idempotencyStore = new InMemoryIdempotencyStore();
  const clock = new FixedClock(TODAY);
  const execute = createLoanUseCase({
    bookRepository,
    loanRepository,
    reservationRepository,
    idempotencyStore,
    clock,
  });
  return {
    bookRepository,
    loanRepository,
    reservationRepository,
    idempotencyStore,
    execute,
  };
}

describe("貸出登録", () => {
  it("book_idが未指定の場合、ValidationErrorを返すこと", () => {
    // Arrange
    const { execute } = setup();

    // Act & Assert
    expect(() =>
      execute({ bookId: "", userId: "user-001", idempotencyKey: "key-1" }),
    ).toThrow(ValidationError);
  });

  it("書籍が存在しない場合、NotFoundErrorを返すこと", () => {
    // Arrange
    const { execute } = setup();

    // Act & Assert
    expect(() =>
      execute({
        bookId: "unknown",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).toThrow(NotFoundError);
  });

  it("貸出不可な書籍の場合、ConflictErrorを返すこと", () => {
    // Arrange
    const { bookRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "on_loan",
    });

    // Act & Assert
    expect(() =>
      execute({
        bookId: "book-1",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).toThrow(ConflictError);
  });

  it("在庫ありでも他の利用者の予約が確保済(reserved)の場合、ConflictErrorを返すこと", () => {
    // Arrange
    const { bookRepository, reservationRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });
    reservationRepository.seed({
      id: "reservation-1",
      bookId: "book-1",
      userId: "user-002",
      status: "reserved",
      queuePosition: 1,
    });

    // Act & Assert
    expect(() =>
      execute({
        bookId: "book-1",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).toThrow(ConflictError);
  });

  it("予約確保済(reserved)の予約者本人の場合、貸出を作成すること", () => {
    // Arrange
    const { bookRepository, reservationRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });
    reservationRepository.seed({
      id: "reservation-1",
      bookId: "book-1",
      userId: "user-001",
      status: "reserved",
      queuePosition: 1,
    });

    // Act
    const result = execute({
      bookId: "book-1",
      userId: "user-001",
      idempotencyKey: "key-1",
    });

    // Assert
    expect(result.bookId).toBe("book-1");
  });

  it("冪等キーが既に処理済みの場合、ConflictErrorを返すこと", () => {
    // Arrange
    const { bookRepository, idempotencyStore, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });
    idempotencyStore.put("key-1");

    // Act & Assert
    expect(() =>
      execute({
        bookId: "book-1",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).toThrow(ConflictError);
  });

  it("冪等キー重複がKVSをすり抜けRDB UNIQUE制約相当で検出された場合、ConflictErrorを返すこと", () => {
    // Arrange: KVS の事前チェックはすり抜けるが、loanRepository.create() が
    // RDB UNIQUE 制約違反(uq_loans_idempotency_key)を模した例外を投げるケース
    // (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-003)。
    const bookRepository = new InMemoryBookRepository();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });
    const failingLoanRepository: LoanRepository = {
      create: (_loan: Loan) => {
        throw new UniqueConstraintViolationError(
          "uq_loans_idempotency_key",
          "uq_loans_idempotency_key 制約違反: key-1",
        );
      },
      findByIdempotencyKey: () => undefined,
      all: () => [],
    };
    const execute = createLoanUseCase({
      bookRepository,
      loanRepository: failingLoanRepository,
      reservationRepository: new InMemoryReservationRepository(),
      idempotencyStore: new InMemoryIdempotencyStore(),
      clock: new FixedClock(TODAY),
    });

    // Act & Assert
    expect(() =>
      execute({
        bookId: "book-1",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).toThrow(ConflictError);
  });

  it("貸出可能な書籍の場合、貸出を作成し書籍状態をon_loanに更新すること", () => {
    // Arrange
    const { bookRepository, loanRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });

    // Act
    const result = execute({
      bookId: "book-1",
      userId: "user-001",
      idempotencyKey: "key-1",
    });

    // Assert
    expect(result.bookId).toBe("book-1");
    expect(result.bookTitle).toBe("テスト書籍");
    expect(result.userId).toBe("user-001");
    expect(result.dueDate.toISOString().substring(0, 10)).toBe("2026-04-26");
    expect(bookRepository.findById("book-1")?.status).toBe("on_loan");
    expect(loanRepository.all()).toHaveLength(1);
  });

  // 出典: spec.md 状態遷移一覧「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」
  it("予約確保済(reserved)の予約者本人が貸出した場合、予約レコードが完了(fulfilled)に更新されること", () => {
    // Arrange
    const { bookRepository, reservationRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });
    reservationRepository.seed({
      id: "reservation-1",
      bookId: "book-1",
      userId: "user-001",
      status: "reserved",
      queuePosition: 1,
    });

    // Act
    execute({
      bookId: "book-1",
      userId: "user-001",
      idempotencyKey: "key-1",
    });

    // Assert: 完了(fulfilled)化された予約は「有効な予約」一覧から外れる
    expect(reservationRepository.findActiveByBookId("book-1")).toHaveLength(0);
  });

  it("予約が存在しない通常貸出の場合、予約完了更新はno-opであること(エラーにならない)", () => {
    // Arrange
    const { bookRepository, reservationRepository, execute } = setup();
    bookRepository.seed({
      id: "book-1",
      title: "テスト書籍",
      status: "available",
    });

    // Act & Assert
    expect(() =>
      execute({
        bookId: "book-1",
        userId: "user-001",
        idempotencyKey: "key-1",
      }),
    ).not.toThrow();
    expect(reservationRepository.findActiveByBookId("book-1")).toHaveLength(0);
  });
});
