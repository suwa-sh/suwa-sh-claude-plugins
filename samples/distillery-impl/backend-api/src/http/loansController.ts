// NOTE: packages/contracts/api-types の barrel(index.ts)は apis/DefaultApi.ts を re-export するが、
// 同ファイルに生成物自体の構文エラーがあり読み込めない(docs/impl/latest/19ec0182/issues/ に起票済み)。
// 本 UC で必要なモデルファイルのみを直接 import して回避する。
import type { CreateLoanRequest } from "../../../packages/contracts/api-types/models/CreateLoanRequest";
import type { LoanResponse } from "../../../packages/contracts/api-types/models/LoanResponse";
import { LoanResponseToJSON } from "../../../packages/contracts/api-types/models/LoanResponse";
import type { ProblemDetails } from "../../../packages/contracts/api-types/models/ProblemDetails";
import { ProblemDetailsToJSON } from "../../../packages/contracts/api-types/models/ProblemDetails";
import type { CreateLoanUseCaseDeps } from "../application/createLoanUseCase";
import { createLoanUseCase } from "../application/createLoanUseCase";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../application/errors";

export interface HttpRequestContext {
  headers: {
    idempotencyKey?: string;
  };
  body: unknown;
  /**
   * TODO(docs/impl/latest/19ec0182/issues/20260729_011215_auth_and_missing_header_gap.md):
   * 本来は OAuth2/OIDC 認証済みトークンの利用者ID(claim の sub 等)。
   * 現状は呼び出し元(server.ts)が X-User-Id ヘッダの値をそのまま渡す仮実装であり、
   * トークン検証・利用者ロール(RBAC)は未実装。認証基盤 tier 用意後に差し替えが必要。
   */
  userId: string;
}

export interface HttpResponse {
  status: number;
  body: LoanResponse | ProblemDetails;
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

export function createLoansController(deps: CreateLoanUseCaseDeps) {
  const execute = createLoanUseCase(deps);

  return function handleCreateLoan(ctx: HttpRequestContext): HttpResponse {
    const request = ctx.body as Partial<CreateLoanRequest> | null;

    try {
      const result = execute({
        bookId: request?.book_id ?? "",
        userId: ctx.userId,
        idempotencyKey: ctx.headers.idempotencyKey ?? "",
      });

      const response: LoanResponse = {
        id: result.id,
        book_id: result.bookId,
        book_title: result.bookTitle,
        user_id: result.userId,
        loan_date: result.loanDate,
        due_date: result.dueDate,
        is_overdue: false,
      };
      return { status: 201, body: LoanResponseToJSON(response) };
    } catch (error) {
      if (error instanceof ValidationError) {
        return problem(400, "Bad Request", error.message);
      }
      if (error instanceof NotFoundError) {
        return problem(404, "Not Found", error.message);
      }
      if (error instanceof ConflictError) {
        return problem(409, "Conflict", error.message);
      }
      throw error;
    }
  };
}
