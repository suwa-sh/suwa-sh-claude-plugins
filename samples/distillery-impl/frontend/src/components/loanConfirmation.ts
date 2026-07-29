// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md
//   「画面仕様(貸出手続き画面)」「UIロジック」「コンポーネント設計(LoanConfirmation)」
//
// 貸出手続き画面のビュー・モデル層。API 呼び出しは packages/contracts/api-client(生成物)経由で行い、
// fetch の直書きはしない(tier-rules.md)。実行環境に react が provision されていない
// (frontend/package.json devDependencies 参照。vitest.config.ts の environment も "node")ため、
// JSX による画面組み立てはこのモジュールの責務としない。packages/ui の Props にそのまま渡せる形の値の
// 算出とドメインロジック(貸出可否・返却期限計算・エラーメッセージ変換)に責務を限定する
// (詳細は docs/impl/latest/19ec0182/issues/ 参照)。
//
// packages/contracts/api-client の barrel(index.ts 経由の DefaultApi)は構文エラーで import 不能なため、
// runtime.ts / models/*.ts を直接 import し、迂回実装の LoanConfirmationApiClient(src/api/ 配下、
// DefaultApi.ts と同一のリクエスト内容)を利用する。詳細は issues/ 参照。
import {
  Configuration,
  ResponseError,
} from "../../../packages/contracts/api-client/runtime";
import type { BookResponse } from "../../../packages/contracts/api-client/models/BookResponse";
import type { LoanResponse } from "../../../packages/contracts/api-client/models/LoanResponse";
import { LoanConfirmationApiClient } from "../api/loanConfirmationApiClient";

/** packages/ui の BookLoanStatusBadge.tsx が扱う status と同じ語彙 */
export type LoanBookStatus = "available" | "on_loan" | "overdue";

/** 貸出手続き画面が表示対象とする書籍情報(BookResponse の画面表示用サブセット) */
export interface LoanConfirmationBook {
  id: string;
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  genre: string;
  materialType: string;
  location?: string;
  status: LoanBookStatus;
}

/** packages/ui の BookCardProps(BookCard.tsx)と同じ形。variant は spec の「detailed」固定 */
export interface BookCardViewProps {
  title: string;
  author: string;
  isbn: string;
  publisher: string;
  genre: string;
  materialType: string;
  location: string;
  status: LoanBookStatus;
  variant: "detailed";
}

/** BookLoanStatusBadge.tsx の statusMap を転記(表示ラベルの正本はそちら) */
const STATUS_LABEL: Record<LoanBookStatus, string> = {
  available: "在庫あり",
  on_loan: "貸出中",
  overdue: "延滞中",
};

const STATUS_BY_LABEL: Record<string, LoanBookStatus> = {
  在庫あり: "available",
  貸出中: "on_loan",
  延滞中: "overdue",
};

// 出典: _model-summary.yaml tables.loans.operations[INSERT].due_date = 「現在日付 + 14日」
const LOAN_PERIOD_DAYS = 14;

/** 出典: tier-frontend.md UIロジック「バリデーション: 書籍の status が "available" でない場合は貸出ボタンを disabled」 */
export function isLoanButtonEnabled(
  book: Pick<LoanConfirmationBook, "status">,
): boolean {
  return book.status === "available";
}

/** BookResponse -> BookCard(variant: detailed) の表示 Props に変換する */
export function toBookCardProps(book: LoanConfirmationBook): BookCardViewProps {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publisher: book.publisher,
    genre: book.genre,
    materialType: book.materialType,
    location: book.location ?? "",
    status: book.status,
    variant: "detailed",
  };
}

/** BookLoanStatusBadge が表示するラベルを返す */
export function toStatusBadgeLabel(status: LoanBookStatus): string {
  return STATUS_LABEL[status];
}

/** 表示ラベル(「在庫あり」等)から status コードへ変換する(BDD ステップの Given 解釈に使用) */
export function statusFromLabel(label: string): LoanBookStatus {
  const status = STATUS_BY_LABEL[label];
  if (status === undefined) {
    throw new Error(`未知の貸出状態ラベルです: ${label}`);
  }
  return status;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** 出典: tier-frontend.md 表示要素「返却期限表示: 「返却期限: YYYY/MM/DD」」 */
export function formatDateSlash(date: Date): string {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

// 出典: tier-frontend.md ティア完了条件(BDD) Scenario「貸出完了後の表示」の例文
//   「貸出が完了しました。返却期限: 2026-04-26」(ハイフン区切り)。
// 表示要素表の「返却期限: YYYY/MM/DD」(スラッシュ区切り)と表記が食い違うため、実行可能な BDD の例文を
// 正として貸出完了メッセージはハイフン区切りで実装する。仕様側の表記不一致は issues/ に起票済み。
//
// LoanResponse.dueDate は契約生成物(LoanResponseFromJSON)が日付専用の ISO 文字列(例 "2026-04-26")を
// `new Date(...)` でパースしたもので、UTC 深夜として解釈される。ローカルタイムのゲッターで取り出すと
// UTC より西のタイムゾーンで日付が 1 日ずれるため、この関数は UTC ゲッターでカレンダー日を取り出す。
export function formatDateHyphen(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** 貸出申請前に表示する予定返却期限(今日 + 14日)。出典: tier-frontend.md 操作フロー 2. */
export function calculateExpectedDueDate(today: Date): Date {
  const due = new Date(today);
  due.setDate(due.getDate() + LOAN_PERIOD_DAYS);
  return due;
}

/** 出典: tier-frontend.md 操作フロー 4.「貸出が完了しました。返却期限: YYYY/MM/DD」表示 */
export function formatCompletionMessage(
  loan: Pick<LoanResponse, "dueDate">,
): string {
  return `貸出が完了しました。返却期限: ${formatDateHyphen(loan.dueDate)}`;
}

/** 出典: tier-frontend.md エラーハンドリング「409 の場合「この書籍は現在貸出できません」エラーバナー」 */
export function mapLoanErrorMessage(error: unknown): string {
  if (error instanceof ResponseError && error.response.status === 409) {
    return "この書籍は現在貸出できません";
  }
  return "貸出処理に失敗しました。もう一度お試しください。";
}

/** BookResponse(契約生成物) -> 画面表示用の LoanConfirmationBook に変換する */
export function toLoanConfirmationBook(
  book: BookResponse,
): LoanConfirmationBook {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    publisher: book.publisher,
    genre: book.genre,
    materialType: book.materialType,
    location: book.location,
    status: book.status,
  };
}

/**
 * 貸出手続き画面のロジック本体。API 呼び出しは packages/contracts/api-client(生成物)経由。
 * 出典: tier-frontend.md コンポーネント設計「LoanConfirmation」(Props: book / onLoan / isLoading)
 */
export class LoanConfirmationController {
  constructor(private readonly api: LoanConfirmationApiClient) {}

  /** 出典: tier-frontend.md UIロジック「状態管理: book_id をクエリパラメータから取得、書籍情報を GET /api/v1/books/:id で取得」 */
  async loadBook(bookId: string): Promise<LoanConfirmationBook> {
    const book = await this.api.getBook({ id: bookId });
    return toLoanConfirmationBook(book);
  }

  /**
   * ルート層(LoanConfirmationPage)向け: 変換前の BookResponse をそのまま返す。
   * LoanConfirmation コンポーネントの Props(book: BookResponse。tier-frontend.md コンポーネント設計)に
   * そのまま渡すために使う(変換は LoanConfirmation 内部で toLoanConfirmationBook を呼んで行う)。
   */
  async loadBookResponse(bookId: string): Promise<BookResponse> {
    return this.api.getBook({ id: bookId });
  }

  /** 出典: tier-frontend.md コンポーネント設計「onLoan: 貸出実行ハンドラ」。冪等キーは呼び出し側が発行する */
  async submitLoan(
    bookId: string,
    idempotencyKey: string,
  ): Promise<LoanResponse> {
    return this.api.createLoan({
      xIdempotencyKey: idempotencyKey,
      createLoanRequest: { bookId },
    });
  }
}

/** LoanConfirmationApiClient の生成ヘルパー。fetchApi を差し替え可能にしてテスト容易性を確保する */
export function createLoanConfirmationApi(
  fetchApi: typeof fetch,
  basePath?: string,
): LoanConfirmationApiClient {
  return new LoanConfirmationApiClient(
    new Configuration({ fetchApi, basePath }),
  );
}
