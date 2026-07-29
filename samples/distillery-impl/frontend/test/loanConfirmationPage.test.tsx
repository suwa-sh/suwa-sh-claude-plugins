import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BookResponse } from "../../packages/contracts/api-client/models/BookResponse";
import type { LoanResponse } from "../../packages/contracts/api-client/models/LoanResponse";
import {
  readBookIdFromLocation,
  renderLoanConfirmationPageBody,
  type LoanConfirmationPageViewState,
} from "../src/pages/LoanConfirmationPage";

// 出典: tier-frontend.md 画面仕様「URL: /loans/new?book_id={book_id}」「UIロジック: ローディング」

describe("readBookIdFromLocation", () => {
  it("book_idクエリパラメータが存在する場合、その値を返すこと", () => {
    // Arrange
    const search = "?book_id=book-1";

    // Act
    const result = readBookIdFromLocation(search);

    // Assert
    expect(result).toBe("book-1");
  });

  it("book_idクエリパラメータが存在しない場合、nullを返すこと", () => {
    // Arrange
    const search = "";

    // Act
    const result = readBookIdFromLocation(search);

    // Assert
    expect(result).toBeNull();
  });
});

describe("貸出手続きページの描画状態(renderLoanConfirmationPageBody)", () => {
  const sampleBook: BookResponse = {
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

  const sampleLoanResult: LoanResponse = {
    id: "loan-1",
    bookId: "book-1",
    bookTitle: "吾輩は猫である",
    userId: "user-1",
    loanDate: new Date("2026-04-12"),
    dueDate: new Date("2026-04-26"),
    isOverdue: false,
  };

  it("読み込み中の場合、読み込み中の表示がDOMに描画されること", () => {
    // Arrange
    const viewState: LoanConfirmationPageViewState = { kind: "loading" };
    const submitLoan = () => Promise.resolve(sampleLoanResult);

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationPageBody(viewState, submitLoan),
    );

    // Assert
    expect(html).toContain("読み込み中");
  });

  it("書籍情報の取得に失敗した場合、エラーバナーがDOMに描画されること", () => {
    // Arrange
    const viewState: LoanConfirmationPageViewState = {
      kind: "error",
      message: "貸出処理に失敗しました。もう一度お試しください。",
    };
    const submitLoan = () => Promise.resolve(sampleLoanResult);

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationPageBody(viewState, submitLoan),
    );

    // Assert
    expect(html).toContain('role="alert"');
    expect(html).toContain("貸出処理に失敗しました。もう一度お試しください。");
  });

  it("書籍情報の取得に成功した場合、LoanConfirmation画面(BookCard)がDOMに描画されること", () => {
    // Arrange
    const viewState: LoanConfirmationPageViewState = {
      kind: "loaded",
      book: sampleBook,
    };
    const submitLoan = () => Promise.resolve(sampleLoanResult);

    // Act
    const html = renderToStaticMarkup(
      renderLoanConfirmationPageBody(viewState, submitLoan),
    );

    // Assert
    expect(html).toContain("吾輩は猫である");
    expect(html).toContain("貸出する");
  });
});
