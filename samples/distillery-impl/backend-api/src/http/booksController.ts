// GET /api/v1/books/:id の最小実装(attempt-3)。
// 出典: _cross-cutting/api/openapi.yaml `/api/v1/books/{id}` get(operationId: getBook)。
// この UC(書籍を貸出する)の _api-summary.yaml には本エンドポイントの宣言が無いが、
// tier-frontend.md UIロジック「書籍情報を GET /api/v1/books/:id で取得」と
// frontend/src/api/loanConfirmationApiClient.ts(LoanConfirmationApiClient.getBook)が
// 前提にしている cross-UC 依存(仕様漏れ)であるため、貸出フローを成立させるために実装する。
// 詳細は docs/impl/latest/19ec0182/issues/ を参照。
//
// レスポンス形は packages/contracts の BookResponse 型(api-types。snake_case)に合わせる。
// loansController.ts と同様、barrel(apis/DefaultApi.ts)の構文エラーを避けるため
// models/BookResponse を直接 import する
// (docs/impl/latest/19ec0182/issues/20260729_011213_api_types_defaultapi_syntax_error.md)。
import type { BookResponse } from "../../../packages/contracts/api-types/models/BookResponse";
import { BookResponseToJSON } from "../../../packages/contracts/api-types/models/BookResponse";
import type { ProblemDetails } from "../../../packages/contracts/api-types/models/ProblemDetails";
import { ProblemDetailsToJSON } from "../../../packages/contracts/api-types/models/ProblemDetails";
import type { Clock } from "../ports/clock";
import type { BookRepository } from "../repositories/bookRepository";

export interface GetBookDeps {
  bookRepository: BookRepository;
  clock: Clock;
}

export interface HttpResponse {
  status: number;
  body: BookResponse | ProblemDetails;
}

function problem(status: number, title: string, detail: string): HttpResponse {
  const problemDetails: ProblemDetails = {
    type: "about:blank",
    title,
    status,
    detail,
  };
  return { status, body: ProblemDetailsToJSON(problemDetails) };
}

export function createBooksController(deps: GetBookDeps) {
  return function handleGetBook(id: string): HttpResponse {
    const book = deps.bookRepository.findById(id);
    if (!book) {
      // 出典: openapi.yaml `/api/v1/books/{id}` get 404 "書籍が見つからない"
      return problem(404, "Not Found", "書籍が見つかりません");
    }

    // 出典: _cross-cutting/datastore/rdb-schema.yaml books テーブル(author/isbn/publisher/genre/
    // material_type は NOT NULL)。この UC の bookRepository は貸出可否判定に必要な
    // id/title/status のみをシードする経路しか持たないため、未シードの項目は空文字で応答する
    // 暫定実装(実データは書籍登録・編集 UC の実装に追従が必要。issues/ 参照)。
    const response: BookResponse = {
      id: book.id,
      title: book.title,
      author: book.author ?? "",
      isbn: book.isbn ?? "",
      publisher: book.publisher ?? "",
      genre: book.genre ?? "",
      material_type: book.materialType ?? "",
      location: book.location,
      status: book.status,
      created_at: book.createdAt ?? deps.clock.today(),
      updated_at: book.updatedAt,
    };
    return { status: 200, body: BookResponseToJSON(response) };
  };
}
