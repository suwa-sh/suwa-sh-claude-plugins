import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { renderToStaticMarkup } from "react-dom/server";

import type { BookStatus } from "../../../backend-api/src/domain/book";
import { createApp } from "../../../backend-api/src/http/server";
import { FixedClock } from "../../../backend-api/src/ports/clock";
import { InMemoryIdempotencyStore } from "../../../backend-api/src/ports/idempotencyStore";
import { InMemoryBookRepository } from "../../../backend-api/src/repositories/bookRepository";
import { InMemoryLoanRepository } from "../../../backend-api/src/repositories/loanRepository";
import { InMemoryReservationRepository } from "../../../backend-api/src/repositories/reservationRepository";

import {
  createLoanConfirmationApi,
  LoanConfirmationController,
  mapLoanErrorMessage,
  toLoanConfirmationBook,
} from "../../../frontend/src/components/loanConfirmation";
import {
  renderLoanConfirmationView,
  type LoanConfirmationHandlers,
  type LoanConfirmationViewState,
} from "../../../frontend/src/components/LoanConfirmationScreen";

// ATDD step 実装: SPEC-002-01(uc_id=19ec0182 の atdd_scenarios のみ対象:
//   @atdd_SPEC-002-01-1 / @atdd_SPEC-002-01-2。features/atdd/SPEC-002-01.feature)
// 出典: specs-root/usdm/latest/requirements.yaml#requirements[REQ-002].specifications[SPEC-002-01]
//   .acceptance_criteria の転写。
//
// S6(features/uc/steps/19ec0182.steps.ts)と同じ方式で実装する: モックfetchは使わず、実 express
// サーバー(backend-api の createApp)を起動し、frontend の LoanConfirmationController /
// renderLoanConfirmationView を実 HTTP 通信・実 DOM 出力(renderToStaticMarkup)で結合する。

const TODAY = new Date(Date.UTC(2026, 3, 12)); // 貸出日 2026-04-12 固定(due_date="2026-04-26" は+14日)

const ACTING_USER_ID = "user-atdd-actor";
const OTHER_USER_ID = "user-atdd-other";

const noopHandlers: LoanConfirmationHandlers = {
  onLoanClick: () => {},
  onBackClick: () => {},
};

interface ScenarioState {
  bookId?: string;
  actingUserId?: string;
  loadError?: unknown;
  submitError?: unknown;
  html?: string;
}

let state: ScenarioState;

Before(async function (this: any) {
  state = {};
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
  this.server = app.listen(0);
  await new Promise<void>((resolve) => {
    this.server.once("listening", () => resolve());
  });
  const address = this.server.address() as AddressInfo;
  this.baseUrl = `http://127.0.0.1:${address.port}`;
});

After(async function (this: any) {
  await new Promise<void>((resolve) => {
    if (this.server) {
      this.server.close(() => resolve());
    } else {
      resolve();
    }
  });
});

function seedBook(world: any, status: BookStatus): string {
  const id = randomUUID();
  world.bookRepository.seed({ id, title: "ATDDテスト書籍", status });
  return id;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const withResponse = error as Error & { response?: Response };
    if (withResponse.response && typeof withResponse.response.status === "number") {
      return `${error.name} (HTTP ${withResponse.response.status}): ${error.message}`;
    }
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function buildController(world: any, userId: string): LoanConfirmationController {
  // 出典: frontend/src/components/loanConfirmation.ts createLoanConfirmationApi。
  // 仕様ギャップ(issue 20260729_011215_auth_and_missing_header_gap.md)による暫定注入:
  // frontend の LoanConfirmationApiClient は X-User-Id ヘッダを送信しない(認証契約未確定のため)。
  // オーケストレータのユーザー確定方針(「ハーネス注入を許容」)に従い、統合テストハーネス側
  // (このファイル)の fetch ラッパでシナリオの利用者を X-User-Id ヘッダとして注入する。
  // frontend/src・backend-api/src は無変更。認証契約確定後、frontend にヘッダ送信が実装され
  // 次第この注入は削除すること。
  const fetchWithUserIdHeader: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("X-User-Id", userId);
    return fetch(input, { ...init, headers });
  };
  return new LoanConfirmationController(
    createLoanConfirmationApi(fetchWithUserIdHeader, world.baseUrl),
  );
}

async function attemptLoan(world: any, userId: string): Promise<void> {
  if (state.bookId === undefined) {
    throw new Error("書籍がセットアップされていない");
  }
  const controller = buildController(world, userId);

  let bookResponse: Awaited<ReturnType<LoanConfirmationController["loadBookResponse"]>>;
  try {
    // 出典: tier-frontend.md UIロジック「状態管理: 書籍情報を GET /api/v1/books/:id で取得」
    bookResponse = await controller.loadBookResponse(state.bookId);
  } catch (error) {
    state.loadError = error;
    return;
  }

  const baseViewState: LoanConfirmationViewState = {
    book: toLoanConfirmationBook(bookResponse),
    today: TODAY,
    isCompleted: false,
    loanResult: null,
    errorMessage: null,
    isSubmitting: false,
  };

  try {
    const idempotencyKey = randomUUID();
    const loanResult = await controller.submitLoan(state.bookId, idempotencyKey);
    state.html = renderToStaticMarkup(
      renderLoanConfirmationView(
        { ...baseViewState, isCompleted: true, loanResult },
        noopHandlers,
      ),
    );
  } catch (error) {
    state.submitError = error;
    state.html = renderToStaticMarkup(
      renderLoanConfirmationView(
        { ...baseViewState, errorMessage: mapLoanErrorMessage(error) },
        noopHandlers,
      ),
    );
  }
}

Given("利用者が貸出可能な書籍を選択済み", function (this: any) {
  state.bookId = seedBook(this, "available");
  state.actingUserId = ACTING_USER_ID;
});

When("貸出ボタンを押す", async function (this: any) {
  await attemptLoan(this, state.actingUserId ?? ACTING_USER_ID);
});

Then("貸出が記録され返却期限が設定される", function (this: any) {
  if (state.loadError) {
    throw new Error(
      `書籍情報の取得(GET /api/v1/books/:id)に失敗した: ${describeError(state.loadError)}`,
    );
  }
  if (state.submitError) {
    throw new Error(
      `貸出実行(POST /api/v1/loans)がエラーになった: ${describeError(state.submitError)}`,
    );
  }
  // 出典: USDM SPEC-002-01 acceptance_criteria 1「貸出が記録され返却期限が設定される」。
  // loans リポジトリに実レコードが作成され、due_date(返却期限)が設定されていることを検証する。
  const loans = this.loanRepository.all() as Array<{
    bookId: string;
    userId: string;
    dueDate: Date;
  }>;
  const created = loans.find(
    (loan) => loan.bookId === state.bookId && loan.userId === state.actingUserId,
  );
  assert.ok(created, "loans リポジトリに貸出レコードが作成されていること");
  assert.ok(
    created?.dueDate instanceof Date,
    "返却期限(due_date)が設定されていること",
  );
  assert.ok(
    state.html?.includes("貸出が完了しました。返却期限:"),
    "画面のDOM出力に返却期限を含む完了メッセージが表示されること",
  );
});

Given("書籍が貸出中の場合", function (this: any) {
  state.bookId = seedBook(this, "on_loan");
});

When("別の利用者が貸出を試みる", async function (this: any) {
  await attemptLoan(this, OTHER_USER_ID);
});

Then("貸出不可のメッセージが表示される", function () {
  if (state.loadError) {
    throw new Error(
      `書籍情報の取得(GET /api/v1/books/:id)に失敗した: ${describeError(state.loadError)}`,
    );
  }
  // 出典: USDM SPEC-002-01 acceptance_criteria 2「貸出不可のメッセージが表示される」。
  assert.ok(
    state.submitError !== undefined,
    "貸出リクエストがエラー(409想定)として処理されていること",
  );
  assert.ok(
    state.html?.includes("この書籍は現在貸出できません"),
    "画面のDOM出力に貸出不可のメッセージが表示されること",
  );
});
