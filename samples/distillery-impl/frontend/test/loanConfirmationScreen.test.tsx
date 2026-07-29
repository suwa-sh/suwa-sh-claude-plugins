import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookResponse } from "../../packages/contracts/api-client/models/BookResponse";
import type { LoanResponse } from "../../packages/contracts/api-client/models/LoanResponse";
import {
  LoanConfirmation,
  renderLoanConfirmationView,
  type LoanConfirmationViewState,
} from "../src/components/LoanConfirmationScreen";
import type { LoanConfirmationBook } from "../src/components/loanConfirmation";

// 出典: tier-frontend.md コンポーネント設計「LoanConfirmation」/ 画面仕様「表示要素とコンポーネントマッピング」
// renderToStaticMarkup で実際の DOM 出力(HTML文字列)を検証する。jsdom は未導入のため、
// クリック等のイベントシミュレーションは行わず、明示的な状態を渡した描画結果の検証にとどめる
// (attempt-1 findings F-001: 画面が実在することの証拠が無い、を解消する)。

const sampleBook: LoanConfirmationBook = {
  id: "book-1",
  title: "吾輩は猫である",
  author: "夏目漱石",
  isbn: "978-4-00-310101-0",
  publisher: "岩波書店",
  genre: "文学",
  materialType: "書籍",
  location: "1F 文学コーナー",
  status: "available",
};

const sampleLoanResult: LoanResponse = {
  id: "loan-1",
  bookId: "book-1",
  bookTitle: "吾輩は猫である",
  userId: "user-1",
  loanDate: new Date("2026-04-12"),
  dueDate: new Date("2026-04-26"),
  isOverdue: false,
};

function baseViewState(
  overrides: Partial<LoanConfirmationViewState>,
): LoanConfirmationViewState {
  return {
    book: sampleBook,
    today: new Date(2026, 3, 12),
    isCompleted: false,
    loanResult: null,
    errorMessage: null,
    isSubmitting: false,
    ...overrides,
  };
}

const noopHandlers = { onLoanClick: () => {}, onBackClick: () => {} };

// 出典: tier-frontend.md 表示要素とコンポーネントマッピング(BookCard detailed / 返却期限表示 / 貸出するボタン)
describe("貸出手続き画面の初期表示(renderLoanConfirmationView)", () => {
  it("在庫ありの書籍の場合、書籍情報カードと有効な貸出するボタンが描画されること", () => {
    // Arrange
    const viewState = baseViewState({});

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationView(viewState, noopHandlers),
    );

    // Assert
    expect(html).toContain("吾輩は猫である");
    expect(html).toContain("在庫あり");
    expect(html).toContain("返却期限: 2026/04/26");
    expect(html).toContain("貸出する");
    const buttonMatch = html.match(/<button[^>]*>貸出する<\/button>/);
    expect(buttonMatch).not.toBeNull();
    expect(buttonMatch?.[0]).not.toContain("disabled");
  });

  it("貸出中の書籍の場合、貸出するボタンが無効化されること", () => {
    // Arrange
    const viewState = baseViewState({
      book: { ...sampleBook, status: "on_loan" },
    });

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationView(viewState, noopHandlers),
    );

    // Assert
    const buttonMatch = html.match(/<button[^>]*>貸出する<\/button>/);
    expect(buttonMatch).not.toBeNull();
    expect(buttonMatch?.[0]).toContain("disabled");
  });
});

// 出典: tier-frontend.md ティア完了条件(BDD) Scenario「貸出完了後の表示」
describe("貸出完了後の表示(renderLoanConfirmationView)", () => {
  it("貸出完了時、完了メッセージがDOMに描画されること", () => {
    // Arrange
    const viewState = baseViewState({
      isCompleted: true,
      loanResult: sampleLoanResult,
    });

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationView(viewState, noopHandlers),
    );

    // Assert
    expect(html).toContain("貸出が完了しました。返却期限: 2026-04-26");
    expect(html).toContain("<output>"); // outputは暗黙role=statusのためrole属性は出力されない
  });
});

// 出典: tier-frontend.md UIロジック「エラーハンドリング: 409 の場合...エラーバナー」
describe("エラー表示(renderLoanConfirmationView)", () => {
  it("エラーメッセージがある場合、エラーバナーがDOMに描画されること", () => {
    // Arrange
    const viewState = baseViewState({
      errorMessage: "この書籍は現在貸出できません",
    });

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationView(viewState, noopHandlers),
    );

    // Assert
    expect(html).toContain('role="alert"');
    expect(html).toContain("この書籍は現在貸出できません");
  });
});

// 出典: tier-frontend.md コンポーネント設計「LoanConfirmation」Props(book/onLoan/isLoading)の実描画確認
describe("LoanConfirmationコンポーネントの実描画", () => {
  const sampleBookResponse: BookResponse = {
    id: "book-1",
    title: "吾輩は猫である",
    author: "夏目漱石",
    isbn: "978-4-00-310101-0",
    publisher: "岩波書店",
    genre: "文学",
    materialType: "書籍",
    location: "1F 文学コーナー",
    status: "available",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };

  it("book Propsを受け取り、packages/uiのBookCardが実際にレンダリングされること", () => {
    // Arrange
    const onLoan = () => Promise.resolve(sampleLoanResult);

    // Act
    const html = renderToStaticMarkup(
      <LoanConfirmation book={sampleBookResponse} onLoan={onLoan} />,
    );

    // Assert
    expect(html).toContain("吾輩は猫である");
    expect(html).toContain("夏目漱石");
    expect(html).toContain("在庫あり");
  });

  it("isLoading Propsがtrueの場合、貸出するボタンが無効化されること", () => {
    // Arrange
    const onLoan = () => Promise.resolve(sampleLoanResult);

    // Act
    const html = renderToStaticMarkup(
      <LoanConfirmation
        book={sampleBookResponse}
        onLoan={onLoan}
        isLoading={true}
      />,
    );

    // Assert: isLoading中はボタン文言も「処理中...」に切り替わる(tier-frontend.md「貸出申請時はボタン disabled + Spinner」)
    const buttonMatch = html.match(/<button[^>]*>処理中\.\.\.<\/button>/);
    expect(buttonMatch).not.toBeNull();
    expect(buttonMatch?.[0]).toContain("disabled");
  });
});
