import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import type { Book, BookStatus } from "../src/domain/book";
import { createApp } from "../src/http/server";
import { FixedClock } from "../src/ports/clock";
import { InMemoryIdempotencyStore } from "../src/ports/idempotencyStore";
import {
  InMemoryBookRepository,
  type BookRepository,
} from "../src/repositories/bookRepository";
import { InMemoryLoanRepository } from "../src/repositories/loanRepository";
import { InMemoryReservationRepository } from "../src/repositories/reservationRepository";

// 出典: docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-003
// リポジトリ層由来の想定外エラー(loansController.ts がハンドリングしない種別)がハンドラまで
// 到達しても、応答無しでリクエストが放置されず HTTP 500 + RFC 7807 で応答することを検証する。

const TODAY = new Date(Date.UTC(2026, 3, 12));
let runningServer: ReturnType<ReturnType<typeof createApp>["listen"]> | null =
  null;

afterEach(async () => {
  if (runningServer) {
    await new Promise<void>((resolve) => {
      runningServer?.close(() => resolve());
    });
    runningServer = null;
  }
});

describe("想定外エラーのハンドリング", () => {
  it("リポジトリ層が想定外の例外を投げた場合、HTTP 500 + RFC7807形式で応答すること", async () => {
    // Arrange
    const failingBookRepository: BookRepository = {
      findById: (_id: string): Book | undefined => {
        throw new Error("想定外のリポジトリ障害");
      },
      updateStatus: (_id: string, _status: BookStatus) => {},
    };
    const app = createApp({
      bookRepository: failingBookRepository,
      loanRepository: new InMemoryLoanRepository(),
      reservationRepository: new InMemoryReservationRepository(),
      idempotencyStore: new InMemoryIdempotencyStore(),
      clock: new FixedClock(TODAY),
    });
    runningServer = app.listen(0);
    await new Promise<void>((resolve) => {
      runningServer?.once("listening", () => resolve());
    });
    const address = runningServer.address() as AddressInfo;

    // Act
    const res = await fetch(`http://127.0.0.1:${address.port}/api/v1/loans`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-1",
        "x-user-id": "user-001",
      },
      body: JSON.stringify({ book_id: "book-1" }),
    });
    const body = (await res.json()) as Record<string, unknown>;

    // Assert
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body.title).toBe("Internal Server Error");
  });
});

// 出典: openapi.yaml `/api/v1/books/{id}` get(operationId: getBook)。
// _api-summary.yaml 未宣言だが tier-frontend.md UIロジックが前提とする cross-UC 依存の最小実装
// (docs/impl/latest/19ec0182/issues/ 参照)。
describe("GET /api/v1/books/:id", () => {
  it("書籍が存在する場合、BookResponse形式でHTTP 200を返却すること", async () => {
    // Arrange
    const bookRepository = new InMemoryBookRepository();
    bookRepository.seed({
      id: "book-1",
      title: "吾輩は猫である",
      status: "available",
    });
    const app = createApp({
      bookRepository,
      loanRepository: new InMemoryLoanRepository(),
      reservationRepository: new InMemoryReservationRepository(),
      idempotencyStore: new InMemoryIdempotencyStore(),
      clock: new FixedClock(TODAY),
    });
    runningServer = app.listen(0);
    await new Promise<void>((resolve) => {
      runningServer?.once("listening", () => resolve());
    });
    const address = runningServer.address() as AddressInfo;

    // Act
    const res = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/books/book-1`,
    );
    const body = (await res.json()) as Record<string, unknown>;

    // Assert
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(body.id).toBe("book-1");
    expect(body.title).toBe("吾輩は猫である");
    expect(body.status).toBe("available");
    expect(typeof body.author).toBe("string");
    expect(typeof body.isbn).toBe("string");
    expect(typeof body.publisher).toBe("string");
    expect(typeof body.genre).toBe("string");
    expect(typeof body.material_type).toBe("string");
    expect(body.created_at).toBeDefined();
  });

  it("書籍が存在しない場合、RFC7807形式でHTTP 404を返却すること", async () => {
    // Arrange
    const app = createApp({
      bookRepository: new InMemoryBookRepository(),
      loanRepository: new InMemoryLoanRepository(),
      reservationRepository: new InMemoryReservationRepository(),
      idempotencyStore: new InMemoryIdempotencyStore(),
      clock: new FixedClock(TODAY),
    });
    runningServer = app.listen(0);
    await new Promise<void>((resolve) => {
      runningServer?.once("listening", () => resolve());
    });
    const address = runningServer.address() as AddressInfo;

    // Act
    const res = await fetch(
      `http://127.0.0.1:${address.port}/api/v1/books/unknown-book`,
    );
    const body = (await res.json()) as Record<string, unknown>;

    // Assert
    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    expect(body.detail).toBe("書籍が見つかりません");
  });
});
