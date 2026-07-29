import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { After, Before, Given, Then, When } from "@cucumber/cucumber";
import { renderToStaticMarkup } from "react-dom/server";

import type { BookStatus } from "../../../backend-api/src/domain/book";
import type {
  Reservation,
  ReservationStatus,
} from "../../../backend-api/src/domain/reservation";
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

// UC BDD step 実装: 書籍を貸出する (uc_id=19ec0182)
// 出典: features/uc/19ec0182.feature
//   (docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/spec.md#E2E完了条件（BDD）の転写)
//
// tier BDD(frontend/features/steps/19ec0182.steps.ts)はモックfetchで frontend 単体を検証したが、
// 本 step は「全 tier 結合」の integration writer(S6)として、実際に backend-api の express サーバーを
// 起動し、frontend の LoanConfirmationController / renderLoanConfirmationView をモック無しの実 HTTP 通信で
// 組み合わせる。tier 実装コード(backend-api/src, frontend/src)は変更しない(write-set 制約)。

const TODAY = new Date(Date.UTC(2026, 3, 12)); // 貸出日 2026-04-12 固定(due_date="2026-04-26" は+14日の期待値)

const USER_IDS: Record<string, string> = {
  田中太郎: "user-tanaka-taro",
  佐藤次郎: "user-sato-jiro",
};

function userIdForName(name: string): string {
  const id = USER_IDS[name];
  if (id === undefined) {
    throw new Error(`未知の利用者名です: ${name}`);
  }
  return id;
}

function mapBookStatusLabel(label: string): BookStatus {
  switch (label) {
    case "在庫あり":
      return "available";
    case "貸出中":
      return "on_loan";
    default:
      throw new Error(`未知の書籍状態ラベルです: ${label}`);
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const withResponse = error as Error & { response?: Response };
    if (
      withResponse.response &&
      typeof withResponse.response.status === "number"
    ) {
      return `${error.name} (HTTP ${withResponse.response.status}): ${error.message}`;
    }
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

const noopHandlers: LoanConfirmationHandlers = {
  onLoanClick: () => {},
  onBackClick: () => {},
};

interface ScenarioState {
  currentUserName?: string;
  bookIdByTitle: Record<string, string>;
  /** 「予約確保済」シナリオで検証対象とする reservation の book_id */
  reservationCheckBookId?: string;
  loadError?: unknown;
  submitError?: unknown;
  loanResult?: { dueDate: Date } & Record<string, unknown>;
  html?: string;
}

let state: ScenarioState;

Before(async function (this: any) {
  state = { bookIdByTitle: {} };
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
  // 出典: impl-config.yaml backend_framework: express。実サーバーを起動して実 HTTP 通信で検証する。
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

function seedBook(world: any, title: string, status: BookStatus): string {
  const id = randomUUID();
  world.bookRepository.seed({ id, title, status });
  state.bookIdByTitle[title] = id;
  return id;
}

function seedReservation(
  world: any,
  bookId: string,
  userId: string,
  status: ReservationStatus,
): void {
  const reservation: Reservation = {
    id: randomUUID(),
    bookId,
    userId,
    status,
    queuePosition: 1,
  };
  world.reservationRepository.seed(reservation);
}

Given(/^利用者「(.+)」がログイン済み$/, function (userName: string) {
  state.currentUserName = userName;
});

Given(
  /^「(.+)」状態で予約なしの書籍「(.+)」が存在する$/,
  function (this: any, statusLabel: string, bookTitle: string) {
    seedBook(this, bookTitle, mapBookStatusLabel(statusLabel));
  },
);

Given(
  /^利用者「(.+)」の予約が「(.+)」の書籍「(.+)」が存在する$/,
  function (
    this: any,
    userName: string,
    reservationStatusLabel: string,
    bookTitle: string,
  ) {
    if (reservationStatusLabel !== "予約確保済") {
      throw new Error(`未対応の予約状態ラベルです: ${reservationStatusLabel}`);
    }
    // 出典: tier-backend-api.md 66行「予約者本人（予約確保済）」の解釈
    //   (docs/impl/latest/19ec0182/issues/20260729_020000_..._reservations_select_missing_in_model_summary.md)
    //   = 有効な予約のうち status が reserved かつ userId が一致するもの
    const bookId = seedBook(this, bookTitle, "available");
    seedReservation(this, bookId, userIdForName(userName), "reserved");
    state.reservationCheckBookId = bookId;
  },
);

Given(
  /^「(.+)」状態の書籍「(.+)」が存在する$/,
  function (this: any, statusLabel: string, bookTitle: string) {
    seedBook(this, bookTitle, mapBookStatusLabel(statusLabel));
  },
);

Given(
  /^「(.+)」状態だが利用者「(.+)」の予約がある書籍「(.+)」が存在する$/,
  function (
    this: any,
    statusLabel: string,
    otherUserName: string,
    bookTitle: string,
  ) {
    const bookId = seedBook(this, bookTitle, mapBookStatusLabel(statusLabel));
    seedReservation(this, bookId, userIdForName(otherUserName), "reserved");
  },
);

function buildController(world: any): LoanConfirmationController {
  // 出典: frontend/src/components/loanConfirmation.ts createLoanConfirmationApi。
  // モックfetchは使わず、Before で起動した実サーバーの baseUrl に対してグローバル fetch で通信する。
  //
  // 仕様ギャップ(issue 20260729_011215_auth_and_missing_header_gap.md)による暫定注入:
  // frontend の LoanConfirmationApiClient(frontend/src/api/loanConfirmationApiClient.ts)は
  // OAuth2/OIDC 認証契約が未確定のため X-User-Id ヘッダを一切送信しない。ユーザー確定方針
  // (「ハーネス注入を許容」)に従い、統合テストハーネス側(このファイル)の fetch ラッパで
  // シナリオの「ログイン済み利用者」を X-User-Id ヘッダとして注入する。frontend/src 自体は
  // 無変更(tier実装は変更禁止)。認証契約確定後、frontend にヘッダ送信が実装され次第この注入は削除すること。
  const fetchWithUserIdHeader: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (state.currentUserName !== undefined) {
      headers.set("X-User-Id", userIdForName(state.currentUserName));
    }
    return fetch(input, { ...init, headers });
  };
  return new LoanConfirmationController(
    createLoanConfirmationApi(fetchWithUserIdHeader, world.baseUrl),
  );
}

async function attemptLoan(world: any, bookTitle: string): Promise<void> {
  const bookId = state.bookIdByTitle[bookTitle];
  if (bookId === undefined) {
    throw new Error(`未セットアップの書籍です: ${bookTitle}`);
  }
  const controller = buildController(world);

  let bookResponse: Awaited<
    ReturnType<LoanConfirmationController["loadBookResponse"]>
  >;
  try {
    // 出典: tier-frontend.md UIロジック「状態管理: 書籍情報を GET /api/v1/books/:id で取得」
    bookResponse = await controller.loadBookResponse(bookId);
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
    // 出典: tier-frontend.md コンポーネント設計「onLoan: 貸出実行ハンドラ」
    const loanResult = await controller.submitLoan(bookId, idempotencyKey);
    state.loanResult = loanResult as unknown as ScenarioState["loanResult"];
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

When(
  /^貸出手続き画面で「(.+)」の「貸出する」ボタンをクリックする$/,
  async function (this: any, bookTitle: string) {
    await attemptLoan(this, bookTitle);
  },
);

When(
  /^書籍「(.+)」の貸出を試みる$/,
  async function (this: any, bookTitle: string) {
    await attemptLoan(this, bookTitle);
  },
);

When(
  /^利用者「(.+)」が書籍「(.+)」の貸出を試みる$/,
  async function (this: any, userName: string, bookTitle: string) {
    state.currentUserName = userName;
    await attemptLoan(this, bookTitle);
  },
);

Then(
  /^「貸出が完了しました。返却期限: (.+)」が表示される$/,
  function (dueDate: string) {
    if (state.loadError) {
      throw new Error(
        `書籍情報の取得(GET /api/v1/books/:id)に失敗したため貸出手続き画面を表示できない: ${describeError(state.loadError)}`,
      );
    }
    if (state.submitError) {
      throw new Error(
        `貸出実行(POST /api/v1/loans)がエラーになったため完了画面を表示できない: ${describeError(state.submitError)}`,
      );
    }
    const expected = `貸出が完了しました。返却期限: ${dueDate}`;
    assert.ok(
      state.html?.includes(expected),
      `画面のDOM出力に完了メッセージが含まれること: ${expected}`,
    );
  },
);

Then(
  /^書籍「(.+)」の状態が「(.+)」に変わる$/,
  function (this: any, bookTitle: string, newStatusLabel: string) {
    const bookId = state.bookIdByTitle[bookTitle];
    const book = this.bookRepository.findById(bookId);
    assert.equal(book?.status, mapBookStatusLabel(newStatusLabel));
  },
);

Then("予約が完了状態になる", function (this: any) {
  // 出典: spec.md 状態遷移一覧「予約状態: 予約確保済 → (終了)。事後処理: 予約レコードを完了に更新」。
  // ReservationRepository(backend-api/src/repositories/reservationRepository.ts、attempt-3)は
  // completeReservedByBookIdAndUserId で予約確保済(reserved)を完了(fulfilled)に更新する。
  // findActiveByBookId は pending/reserved のみを返す(fulfilled/cancelled は除外)ため、
  // 貸出成功後に対象書籍の予約が active 一覧から消えている(=reserved のまま残っていない)ことを
  // もって「完了状態になった」ことを検証する(fulfilled を直接読むpublicメソッドは無いため)。
  if (state.reservationCheckBookId === undefined) {
    throw new Error("予約情報がセットアップされていない");
  }
  const activeReservations: Reservation[] =
    this.reservationRepository.findActiveByBookId(state.reservationCheckBookId);
  const stillReservedActive = activeReservations.some(
    (reservation) => reservation.status === "reserved",
  );
  assert.equal(
    stillReservedActive,
    false,
    "予約レコードが「完了」に更新されておらず reserved のまま active 一覧に残っている",
  );
});

Then("「この書籍は現在貸出できません」エラーが表示される", function () {
  if (state.loadError) {
    throw new Error(
      `書籍情報の取得(GET /api/v1/books/:id)に失敗したため貸出試行自体が行えない: ${describeError(state.loadError)}`,
    );
  }
  assert.ok(
    state.submitError !== undefined,
    "貸出リクエストがエラー(409想定)として処理されていること",
  );
  const expected = "この書籍は現在貸出できません";
  assert.ok(
    state.html?.includes(expected),
    `画面のDOM出力にエラーメッセージが含まれること: ${expected}`,
  );
});
