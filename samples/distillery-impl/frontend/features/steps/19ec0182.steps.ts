import assert from "node:assert/strict";
import { Before, Given, Then, When } from "@cucumber/cucumber";
import { renderToStaticMarkup } from "react-dom/server";
import type { LoanResponse } from "../../../packages/contracts/api-client/models/LoanResponse";
import {
  createLoanConfirmationApi,
  isLoanButtonEnabled,
  LoanConfirmationController,
  statusFromLabel,
  toStatusBadgeLabel,
  type LoanConfirmationBook,
} from "../../src/components/loanConfirmation";
import {
  renderLoanConfirmationView,
  type LoanConfirmationHandlers,
  type LoanConfirmationViewState,
} from "../../src/components/LoanConfirmationScreen";

// tier BDD step 実装: 書籍を貸出する - フロントエンド (uc_id=19ec0182)
// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md#ティア完了条件（BDD）
//
// attempt-2 で LoanConfirmation 画面コンポーネント(src/components/LoanConfirmationScreen.tsx)を実装したため、
// Then step は計算済みオブジェクトの比較ではなく、react-dom/server の renderToStaticMarkup で実際に
// 描画した DOM 出力(HTML文字列)を検証する(attempt-1 findings F-001 の是正: 画面が実在することの証拠を残す)。
// jsdom は未導入のため、実際のクリックイベントはシミュレートせず、貸出実行後の状態を明示的に構築して
// 同じ描画関数(renderLoanConfirmationView)で再描画する(frontend/test/loanConfirmationScreen.test.tsx と同じ手法)。

interface ScenarioState {
  bookId: string;
  bookFixture?: Record<string, unknown>;
  loanFixture?: Record<string, unknown>;
  loanResponseStatus?: number;
  book?: LoanConfirmationBook;
  badgeLabel?: string;
  buttonEnabled?: boolean;
  loanResult?: LoanResponse;
  loanError?: unknown;
  /** renderLoanConfirmationView が出力した実際の DOM(HTML文字列) */
  html?: string;
}

const BOOK_ID = "book-1";

const noopHandlers: LoanConfirmationHandlers = {
  onLoanClick: () => {},
  onBackClick: () => {},
};

let state: ScenarioState = { bookId: BOOK_ID };

Before(() => {
  state = { bookId: BOOK_ID };
});

function defaultBookFixture(bookId: string): Record<string, unknown> {
  return {
    id: bookId,
    title: "吾輩は猫である",
    author: "夏目漱石",
    isbn: "978-4-00-310101-0",
    publisher: "岩波書店",
    genre: "文学",
    material_type: "書籍",
    location: "1F 文学コーナー",
    status: "available",
    created_at: "2026-04-12T00:00:00.000Z",
  };
}

function buildController(): LoanConfirmationController {
  const fetchApi = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (method === "POST" && url.endsWith("/api/v1/loans")) {
      state.loanResponseStatus = 201;
      return new Response(JSON.stringify(state.loanFixture), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }

    if (method === "GET" && url.endsWith(`/api/v1/books/${state.bookId}`)) {
      return new Response(JSON.stringify(state.bookFixture), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`未設定のモックリクエストです: ${method} ${url}`);
  };

  return new LoanConfirmationController(createLoanConfirmationApi(fetchApi));
}

function renderView(
  book: LoanConfirmationBook,
  overrides: Partial<LoanConfirmationViewState> = {},
): string {
  const viewState: LoanConfirmationViewState = {
    book,
    today: new Date(2026, 3, 12),
    isCompleted: false,
    loanResult: null,
    errorMessage: null,
    isSubmitting: false,
    ...overrides,
  };
  return renderToStaticMarkup(
    renderLoanConfirmationView(viewState, noopHandlers),
  );
}

async function accessLoanScreen(): Promise<void> {
  const controller = buildController();
  const book = await controller.loadBook(state.bookId);
  state.book = book;
  state.badgeLabel = toStatusBadgeLabel(book.status);
  state.buttonEnabled = isLoanButtonEnabled(book);
  // 実際に LoanConfirmation 画面(packages/ui の BookCard/Button)を DOM 描画する
  state.html = renderView(book);
}

Given(/^利用者「(.+)」がログイン済み$/, (_userName: string) => {
  // 出典: tier-frontend.md「アクセス権: 利用者ロール」。ログイン状態そのものは認可(backend)側の関心事のため、
  // frontend tier BDD ではシナリオの前提条件として記録するのみ(検証は行わない)。
});

Given(
  /^「(.+)」の書籍「(.+)」が存在する$/,
  (statusLabel: string, bookTitle: string) => {
    state.bookFixture = {
      ...defaultBookFixture(state.bookId),
      title: bookTitle,
      status: statusFromLabel(statusLabel),
    };
  },
);

When(/^\/loans\/new\?book_id=\{bookId\} にアクセスする$/, async () => {
  await accessLoanScreen();
});

Given("貸出手続き画面が表示されている", async () => {
  state.bookFixture = state.bookFixture ?? defaultBookFixture(state.bookId);
  await accessLoanScreen();
});

When("「貸出する」ボタンをクリックする", async () => {
  state.loanFixture = {
    id: "loan-1",
    book_id: state.bookId,
    book_title: state.book?.title ?? "吾輩は猫である",
    user_id: "user-1",
    loan_date: "2026-04-12",
    due_date: "2026-04-26",
    is_overdue: false,
  };
  const controller = buildController();
  try {
    const loanResult = await controller.submitLoan(
      state.bookId,
      "idem-key-e2e-1",
    );
    state.loanResult = loanResult;
    if (state.book) {
      // 貸出完了後の状態を明示的に構築し、実描画コンポーネントと同じ関数で再描画する
      state.html = renderView(state.book, {
        isCompleted: true,
        loanResult,
      });
    }
  } catch (error) {
    state.loanError = error;
  }
});

When("API が HTTP 201 を返す", () => {
  assert.equal(state.loanResponseStatus, 201);
});

Then(/^BookCard に「(.+)」の情報が表示される$/, (bookTitle: string) => {
  assert.ok(
    state.html?.includes(bookTitle),
    `画面のDOM出力に書籍タイトルが含まれること: ${bookTitle}`,
  );
});

Then(
  /^BookLoanStatusBadge が「(.+)」\((.+)\) を表示する$/,
  (statusLabel: string, statusValue: string) => {
    assert.ok(
      state.html?.includes(statusLabel),
      `画面のDOM出力に貸出状態ラベルが含まれること: ${statusLabel}`,
    );
    assert.equal(state.badgeLabel, statusLabel);
    assert.equal(state.book?.status, statusValue);
  },
);

Then("「貸出する」ボタンが有効である", () => {
  assert.equal(state.buttonEnabled, true);
  const buttonMatch = state.html?.match(/<button[^>]*>貸出する<\/button>/);
  assert.ok(buttonMatch, "貸出するボタンがDOMに描画されていること");
  assert.ok(
    !buttonMatch?.[0].includes("disabled"),
    "貸出するボタンがdisabledでないこと",
  );
});

Then(
  /^「貸出が完了しました。返却期限: (.+)」が表示される$/,
  (dueDate: string) => {
    if (!state.loanResult) {
      throw state.loanError instanceof Error
        ? state.loanError
        : new Error("貸出結果が取得できていません");
    }
    const expected = `貸出が完了しました。返却期限: ${dueDate}`;
    assert.ok(
      state.html?.includes(expected),
      `画面のDOM出力に完了メッセージが含まれること: ${expected}`,
    );
  },
);
