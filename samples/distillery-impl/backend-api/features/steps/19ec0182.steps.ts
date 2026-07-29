import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { createApp } from "../../src/http/server";
import { FixedClock } from "../../src/ports/clock";
import { InMemoryIdempotencyStore } from "../../src/ports/idempotencyStore";
import { InMemoryBookRepository } from "../../src/repositories/bookRepository";
import { InMemoryLoanRepository } from "../../src/repositories/loanRepository";
import { InMemoryReservationRepository } from "../../src/repositories/reservationRepository";

// tier BDD step: 書籍を貸出する - バックエンドAPI (uc_id=19ec0182)
// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-backend-api.md#ティア完了条件（BDD）
// 貸出日は 2026-04-12 に固定する(due_date="2026-04-26" は 14 日後の期待値のため)。

const TODAY = new Date(Date.UTC(2026, 3, 12));

function mapBookStatusLabel(
  label: string,
): "available" | "on_loan" | "overdue" {
  switch (label) {
    case "在庫あり":
      return "available";
    case "貸出中":
      return "on_loan";
    default:
      throw new Error(`未知の書籍状態ラベル: ${label}`);
  }
}

async function postLoan(
  baseUrl: string,
  params: { bookId: string; userId: string; idempotencyKey: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/v1/loans`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-idempotency-key": params.idempotencyKey,
      "x-user-id": params.userId,
    },
    body: JSON.stringify({ book_id: params.bookId }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

Before(async function () {
  this.bookRepository = new InMemoryBookRepository();
  this.loanRepository = new InMemoryLoanRepository();
  this.reservationRepository = new InMemoryReservationRepository();
  this.idempotencyStore = new InMemoryIdempotencyStore();
  const app = createApp({
    bookRepository: this.bookRepository,
    loanRepository: this.loanRepository,
    reservationRepository: this.reservationRepository,
    idempotencyStore: this.idempotencyStore,
    clock: new FixedClock(TODAY),
  });
  // 出典: impl-config.yaml backend_framework: express。attempt-2 で express 化したため、
  // createApp は Express アプリを返す(listen() すると http.Server が返る)。
  this.server = app.listen(0);
  await new Promise<void>((resolve) => {
    this.server.once("listening", () => resolve());
  });
  const address = this.server.address() as AddressInfo;
  this.baseUrl = `http://127.0.0.1:${address.port}`;
});

After(async function () {
  await new Promise<void>((resolve) => {
    if (this.server) {
      this.server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

Given(
  /^「(.+)」で予約なしの書籍 book_id="(.+)" が存在する$/,
  function (status: string, bookId: string) {
    this.bookRepository.seed({
      id: bookId,
      title: "テスト書籍",
      status: mapBookStatusLabel(status),
    });
  },
);

Given(
  /^利用者 user_id="(.+)" のアクセストークンが有効$/,
  function (userId: string) {
    this.currentUserId = userId;
  },
);

When(
  /^POST \/api\/v1\/loans に book_id="(.+)" を送信する$/,
  async function (bookId: string) {
    this.lastResponse = await postLoan(this.baseUrl, {
      bookId,
      userId: this.currentUserId ?? "",
      idempotencyKey: randomUUID(),
    });
  },
);

Then(/^HTTP (\d+) が返却される$/, function (statusCode: string) {
  assert.equal(this.lastResponse.status, Number(statusCode));
});

Then(/^レスポンスの due_date が「(.+)」である$/, function (dueDate: string) {
  assert.equal(this.lastResponse.body.due_date, dueDate);
});

Then(
  /^books テーブルの id="(.+)" の status が "(.+)" に更新されている$/,
  function (bookId: string, status: string) {
    const book = this.bookRepository.findById(bookId);
    assert.equal(book?.status, status);
  },
);

Then(
  /^loans テーブルに book_id="(.+)", user_id="(.+)" のレコードが作成されている$/,
  function (bookId: string, userId: string) {
    const found = this.loanRepository
      .all()
      .some(
        (loan: { bookId: string; userId: string }) =>
          loan.bookId === bookId && loan.userId === userId,
      );
    assert.ok(
      found,
      `loans に book_id=${bookId}, user_id=${userId} のレコードが見つからない`,
    );
  },
);

Given(
  /^冪等キー "(.+)" で貸出が完了済み$/,
  async function (idempotencyKey: string) {
    const bookId = "idempotency-setup-book";
    this.bookRepository.seed({
      id: bookId,
      title: "テスト書籍",
      status: "available",
    });
    const setupResponse = await postLoan(this.baseUrl, {
      bookId,
      userId: "user-idempotency-setup",
      idempotencyKey,
    });
    assert.equal(
      setupResponse.status,
      201,
      "前提条件(冪等キーでの貸出完了)のセットアップに失敗した",
    );
    this.loanCountBeforeDuplicateAttempt = this.loanRepository.all().length;
  },
);

When(
  /^同じ冪等キー "(.+)" で POST \/api\/v1\/loans を送信する$/,
  async function (idempotencyKey: string) {
    this.lastResponse = await postLoan(this.baseUrl, {
      bookId: "idempotency-setup-book",
      userId: "user-idempotency-setup",
      idempotencyKey,
    });
  },
);

Then("新しい貸出レコードは作成されない", function () {
  assert.equal(
    this.loanRepository.all().length,
    this.loanCountBeforeDuplicateAttempt,
  );
});
