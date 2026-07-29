import { describe, expect, it } from "vitest";
import { calculateDueDate, canLend } from "../src/domain/loan";

// 出典: tier-backend-api.md ビジネスルール「貸出可否判定ルール」
// 書籍の status が "available" かつ予約受付中の予約がない場合に貸出可能。
// 予約情報は reservations テーブル(status: pending/reserved/cancelled)経由で判定する
// (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-001)。

describe("貸出可否判定", () => {
  it("書籍が貸出中の場合、貸出不可であること", () => {
    // Arrange
    const book = { status: "on_loan" as const };

    // Act
    const result = canLend(book, "user-001", []);

    // Assert
    expect(result).toBe(false);
  });

  it("在庫ありで有効な予約がない場合、貸出可能であること", () => {
    // Arrange
    const book = { status: "available" as const };

    // Act
    const result = canLend(book, "user-001", []);

    // Assert
    expect(result).toBe(true);
  });

  it("在庫ありだが他の利用者の予約が受付中(pending)の場合、貸出不可であること", () => {
    // Arrange
    const book = { status: "available" as const };
    const activeReservations = [
      { userId: "user-002", status: "pending" as const },
    ];

    // Act
    const result = canLend(book, "user-001", activeReservations);

    // Assert
    expect(result).toBe(false);
  });

  it("在庫ありだが予約者本人でも予約が受付中(pending)で未確保の場合、貸出不可であること", () => {
    // Arrange
    const book = { status: "available" as const };
    const activeReservations = [
      { userId: "user-001", status: "pending" as const },
    ];

    // Act
    const result = canLend(book, "user-001", activeReservations);

    // Assert
    expect(result).toBe(false);
  });

  it("在庫ありで予約者本人の予約が確保済(reserved)の場合、貸出可能であること", () => {
    // Arrange
    const book = { status: "available" as const };
    const activeReservations = [
      { userId: "user-001", status: "reserved" as const },
    ];

    // Act
    const result = canLend(book, "user-001", activeReservations);

    // Assert
    expect(result).toBe(true);
  });

  it("在庫ありで他の利用者の予約が確保済(reserved)の場合、貸出不可であること", () => {
    // Arrange
    const book = { status: "available" as const };
    const activeReservations = [
      { userId: "user-002", status: "reserved" as const },
    ];

    // Act
    const result = canLend(book, "user-001", activeReservations);

    // Assert
    expect(result).toBe(false);
  });
});

describe("貸出期限計算", () => {
  it("貸出日から14日後を返却期限とすること", () => {
    // Arrange
    const loanDate = new Date(Date.UTC(2026, 3, 12));

    // Act
    const result = calculateDueDate(loanDate);

    // Assert
    expect(result.toISOString().substring(0, 10)).toBe("2026-04-26");
  });

  it("月をまたぐ場合も14日後を返却期限とすること", () => {
    // Arrange
    const loanDate = new Date(Date.UTC(2026, 0, 25));

    // Act
    const result = calculateDueDate(loanDate);

    // Assert
    expect(result.toISOString().substring(0, 10)).toBe("2026-02-08");
  });
});
