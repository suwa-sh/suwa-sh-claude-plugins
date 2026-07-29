import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import type { CreateLoanUseCaseDeps } from "../application/createLoanUseCase";
import { createBooksController } from "./booksController";
import {
  createLoansController,
  type HttpRequestContext,
} from "./loansController";

// 出典: impl-config.yaml backend_framework: express(2026-07-29 ユーザー確定)。
// attempt-1 は express 未インストールのため node:http で代替実装していたが(issues起票済み)、
// attempt-2 でオーケストレータが backend-api workspace に express をインストール済みのため
// express の Router ベースに置き換えた。loansController.ts のハンドラ本体は変更なしで流用する。

function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sendProblem(
  res: Response,
  status: number,
  title: string,
  detail: string,
): void {
  res
    .status(status)
    .type("application/problem+json")
    .send(JSON.stringify({ type: "about:blank", title, status, detail }));
}

export function createApp(deps: CreateLoanUseCaseDeps): Express {
  const handleCreateLoan = createLoansController(deps);
  // 出典: openapi.yaml `/api/v1/books/{id}` get(_api-summary.yaml 未宣言の cross-UC 依存。
  // tier-frontend.md UIロジック「書籍情報を GET /api/v1/books/:id で取得」を成立させるための
  // 最小実装。docs/impl/latest/19ec0182/issues/ 参照)。
  const handleGetBook = createBooksController({
    bookRepository: deps.bookRepository,
    clock: deps.clock,
  });
  const app = express();
  app.use(express.json());

  app.get(
    "/api/v1/books/:id",
    (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const { status, body: responseBody } = handleGetBook(req.params.id);
        res
          .status(status)
          .type(
            status === 200 ? "application/json" : "application/problem+json",
          )
          .send(JSON.stringify(responseBody));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/v1/loans",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const ctx: HttpRequestContext = {
          headers: {
            idempotencyKey: firstHeaderValue(req.headers["x-idempotency-key"]),
          },
          body: req.body,
          // TODO(docs/impl/latest/19ec0182/issues/20260729_011215_auth_and_missing_header_gap.md):
          // OAuth2/OIDC 認証済みトークンの利用者IDへ差し替えが必要な仮実装(スタブ)。
          userId: firstHeaderValue(req.headers["x-user-id"]) ?? "",
        };
        const { status, body: responseBody } = handleCreateLoan(ctx);
        res
          .status(status)
          .type(
            status === 201 ? "application/json" : "application/problem+json",
          )
          .send(JSON.stringify(responseBody));
      } catch (error) {
        // handleCreateLoan は想定内のエラー(Validation/NotFound/Conflict)を全て
        // HttpResponse に変換済みのため、ここに到達するのは想定外の例外のみ。
        // Express 5 は同期 throw も自動転送するが、意図を明示するため next(error) も呼ぶ。
        next(error);
      }
    },
  );

  app.use((_req: Request, res: Response) => {
    sendProblem(res, 404, "Not Found", "指定されたリソースが見つかりません");
  });

  // F-003: 未捕捉例外用の最終フォールバック。RDB UNIQUE 制約違反などリポジトリ層由来の
  // 想定外エラーがここまで到達した場合でも、レスポンス無応答(タイムアウト)にせず
  // 500 + RFC 7807 形式で必ず応答を返す
  // (docs/impl/latest/19ec0182/stages/attempt-1/S5_verify.tier-backend-api.findings.yaml F-003)。
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const detail =
      err instanceof Error ? err.message : "予期しないエラーが発生しました";
    sendProblem(res, 500, "Internal Server Error", detail);
  });

  return app;
}
