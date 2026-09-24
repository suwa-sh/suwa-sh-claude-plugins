import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { ForbiddenError } from '../../usecase/auth/principal';
import type { Authenticator } from './authenticator';
import { BodyTooLarge, readBody, sendJson, sendProblem } from './http-io';
import { handleCreateLoan, type RegisterLoanUseCase } from './loans/create-loan-handler';
import {
  forbiddenProblem,
  internalErrorProblem,
  notFoundProblem,
  unauthorizedProblem,
  validationProblem,
} from './problem';

export interface HttpAppDeps {
  authenticator: Authenticator;
  registerLoan: RegisterLoanUseCase;
  /** 契約 servers の url (本番は /api/v1)。契約テストの composition root は '' で経路をそのまま当てる */
  basePath?: string;
  /** 想定外の失敗の通知先 (ログ)。既定は標準エラー */
  onUnexpectedError?: (error: unknown) => void;
}

/**
 * HTTP の入口。HTTP 固有の型はこの層に閉じ、usecase には渡さない (ADR 0002)。
 * 依存を増やさないため node:http の RequestListener として実装する。
 */
export function createHttpApp(deps: HttpAppDeps): RequestListener {
  const basePath = deps.basePath ?? '/api/v1';
  const onUnexpectedError = deps.onUnexpectedError ?? ((e: unknown) => console.error(e));

  return (req: IncomingMessage, res: ServerResponse) => {
    route(req, res).catch((e: unknown) => {
      onUnexpectedError(e);
      if (!res.headersSent) sendProblem(res, internalErrorProblem());
      else res.end();
    });
  };

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (req.method === 'POST' && path === `${basePath}/loans`) {
      await createLoan(req, res);
      return;
    }
    sendProblem(res, notFoundProblem(undefined, '指定した URL の操作はありません'));
  }

  async function createLoan(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const principal = await deps.authenticator.authenticate(req.headers.authorization);
    if (!principal) {
      sendProblem(res, unauthorizedProblem());
      return;
    }

    let body: unknown;
    try {
      const raw = await readBody(req);
      body = raw.length === 0 ? undefined : JSON.parse(raw);
    } catch (e) {
      const message =
        e instanceof BodyTooLarge ? 'リクエスト本文が大きすぎます' : 'リクエスト本文を JSON として読み取れません';
      sendProblem(res, validationProblem([{ field: 'body', message }]));
      return;
    }

    try {
      const result = await handleCreateLoan(deps.registerLoan, principal, body);
      if ('problem' in result) sendProblem(res, result.problem);
      else sendJson(res, result.status, result.body);
    } catch (e) {
      if (e instanceof ForbiddenError) {
        sendProblem(res, forbiddenProblem());
        return;
      }
      throw e;
    }
  }
}
