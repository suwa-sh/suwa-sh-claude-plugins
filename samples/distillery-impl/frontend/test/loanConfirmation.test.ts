import { describe, expect, it } from "vitest";
import { ResponseError } from "../../packages/contracts/api-client/runtime";
import {
  calculateExpectedDueDate,
  createLoanConfirmationApi,
  formatCompletionMessage,
  formatDateHyphen,
  formatDateSlash,
  isLoanButtonEnabled,
  LoanConfirmationController,
  mapLoanErrorMessage,
  statusFromLabel,
  toBookCardProps,
  toStatusBadgeLabel,
} from "../src/components/loanConfirmation";

// 出典: tier-frontend.md UIロジック「バリデーション: 書籍の status が "available" でない場合は貸出ボタンを disabled」
describe("貸出するボタンの活性制御", () => {
  it("書籍のstatusがavailableでない場合、無効であること", () => {
    // Arrange
    const book = { id: "book-1", status: "on_loan" as const };

    // Act
    const result = isLoanButtonEnabled(book);

    // Assert
    expect(result).toBe(false);
  });

  it("書籍のstatusがavailableの場合、有効であること", () => {
    // Arrange
    const book = { id: "book-1", status: "available" as const };

    // Act
    const result = isLoanButtonEnabled(book);

    // Assert
    expect(result).toBe(true);
  });
});

// 出典: tier-frontend.md 表示要素とコンポーネントマッピング「書籍情報カード | BookCard (detailed)」
describe("BookCard表示Propsへの変換", () => {
  it("detailedバリアントで書籍情報がPropsに変換されること", () => {
    // Arrange
    const book = {
      id: "book-1",
      title: "吾輩は猫である",
      author: "夏目漱石",
      isbn: "978-4-00-310101-0",
      publisher: "岩波書店",
      genre: "文学",
      materialType: "書籍",
      location: "1F 文学コーナー",
      status: "available" as const,
    };

    // Act
    const result = toBookCardProps(book);

    // Assert
    expect(result).toEqual({
      title: "吾輩は猫である",
      author: "夏目漱石",
      isbn: "978-4-00-310101-0",
      publisher: "岩波書店",
      genre: "文学",
      materialType: "書籍",
      location: "1F 文学コーナー",
      status: "available",
      variant: "detailed",
    });
  });
});

// 出典: tier-frontend.md 表示要素とコンポーネントマッピング「貸出状態バッジ | BookLoanStatusBadge (available)」
describe("BookLoanStatusBadgeラベル変換", () => {
  it("statusがavailableの場合、在庫ありを返すこと", () => {
    // Arrange
    const status = "available" as const;

    // Act
    const result = toStatusBadgeLabel(status);

    // Assert
    expect(result).toBe("在庫あり");
  });

  it("statusがon_loanの場合、貸出中を返すこと", () => {
    // Arrange
    const status = "on_loan" as const;

    // Act
    const result = toStatusBadgeLabel(status);

    // Assert
    expect(result).toBe("貸出中");
  });

  it("statusがoverdueの場合、延滞中を返すこと", () => {
    // Arrange
    const status = "overdue" as const;

    // Act
    const result = toStatusBadgeLabel(status);

    // Assert
    expect(result).toBe("延滞中");
  });

  it("在庫ありラベルの場合、availableに変換されること", () => {
    // Arrange
    const label = "在庫あり";

    // Act
    const result = statusFromLabel(label);

    // Assert
    expect(result).toBe("available");
  });
});

// 出典: tier-frontend.md 操作フロー「2. 書籍情報と予定返却期限(今日 + 14日)が表示される」
describe("予定返却期限の計算とフォーマット", () => {
  it("今日から14日後が予定返却期限になること", () => {
    // Arrange
    const today = new Date(2026, 3, 12); // 2026-04-12(月は0始まり)

    // Act
    const result = calculateExpectedDueDate(today);

    // Assert
    expect(result).toEqual(new Date(2026, 3, 26));
  });

  it("スラッシュ区切りでフォーマットされること", () => {
    // Arrange
    const date = new Date(2026, 3, 26);

    // Act
    const result = formatDateSlash(date);

    // Assert
    expect(result).toBe("2026/04/26");
  });

  it("ハイフン区切りでフォーマットされること", () => {
    // Arrange: LoanResponse.dueDate は契約生成物が ISO 日付文字列を UTC としてパースするため UTC で構築する
    const date = new Date("2026-04-26");

    // Act
    const result = formatDateHyphen(date);

    // Assert
    expect(result).toBe("2026-04-26");
  });
});

// 出典: tier-frontend.md ティア完了条件(BDD) Scenario「貸出完了後の表示」
describe("貸出完了メッセージのフォーマット", () => {
  it("返却期限を含む完了メッセージが生成されること", () => {
    // Arrange: LoanResponse.dueDate は契約生成物が ISO 日付文字列を UTC としてパースするため UTC で構築する
    const loan = { dueDate: new Date("2026-04-26") };

    // Act
    const result = formatCompletionMessage(loan);

    // Assert
    expect(result).toBe("貸出が完了しました。返却期限: 2026-04-26");
  });
});

// 出典: tier-frontend.md UIロジック「エラーハンドリング: 409 の場合「この書籍は現在貸出できません」エラーバナー」
describe("貸出エラーメッセージのマッピング", () => {
  it("409エラーの場合、貸出できません旨のメッセージを返すこと", () => {
    // Arrange
    const response = new Response(null, { status: 409 });
    const error = new ResponseError(
      response,
      "Response returned an error code",
    );

    // Act
    const result = mapLoanErrorMessage(error);

    // Assert
    expect(result).toBe("この書籍は現在貸出できません");
  });

  it("409以外のエラーの場合、汎用エラーメッセージを返すこと", () => {
    // Arrange
    const error = new Error("network down");

    // Act
    const result = mapLoanErrorMessage(error);

    // Assert
    expect(result).toBe("貸出処理に失敗しました。もう一度お試しください。");
  });
});

// 出典: tier-rules.md frontend系「API 呼び出しは packages/contracts/api-client(生成物)経由」
describe("LoanConfirmationController", () => {
  it("書籍IDを指定して書籍情報を取得できること", async () => {
    // Arrange
    const bookJson = {
      id: "book-1",
      title: "吾輩は猫である",
      author: "夏目漱石",
      isbn: "978-4-00-310101-0",
      publisher: "岩波書店",
      genre: "文学",
      material_type: "書籍",
      location: "1F 文学コーナー",
      status: "available",
      created_at: "2026-01-01T00:00:00.000Z",
    };
    const fetchApi = async () =>
      new Response(JSON.stringify(bookJson), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const controller = new LoanConfirmationController(
      createLoanConfirmationApi(fetchApi),
    );

    // Act
    const result = await controller.loadBook("book-1");

    // Assert
    expect(result).toEqual({
      id: "book-1",
      title: "吾輩は猫である",
      author: "夏目漱石",
      isbn: "978-4-00-310101-0",
      publisher: "岩波書店",
      genre: "文学",
      materialType: "書籍",
      location: "1F 文学コーナー",
      status: "available",
    });
  });

  it("冪等キーを付与して貸出を申請できること", async () => {
    // Arrange
    let capturedIdempotencyKey: string | null = null;
    const loanJson = {
      id: "loan-1",
      book_id: "book-1",
      book_title: "吾輩は猫である",
      user_id: "user-1",
      loan_date: "2026-04-12",
      due_date: "2026-04-26",
      is_overdue: false,
    };
    const fetchApi = async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      capturedIdempotencyKey = headers.get("X-Idempotency-Key");
      return new Response(JSON.stringify(loanJson), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };
    const controller = new LoanConfirmationController(
      createLoanConfirmationApi(fetchApi),
    );

    // Act
    const result = await controller.submitLoan("book-1", "idem-key-1");

    // Assert
    expect(capturedIdempotencyKey).toBe("idem-key-1");
    expect(result.bookTitle).toBe("吾輩は猫である");
    expect(formatCompletionMessage(result)).toBe(
      "貸出が完了しました。返却期限: 2026-04-26",
    );
  });
});
