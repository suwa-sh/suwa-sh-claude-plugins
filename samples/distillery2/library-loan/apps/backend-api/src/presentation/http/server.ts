/**
 * node:http の request handler。HTTP フレームワークは未定 (ADR 0002) のため、
 * HTTP 固有の型はこのファイルに閉じ込め、usecase 以下へは持ち込まない。
 * 経路 (method/path) は契約の生成物 packages/contracts/api/server.ts の operations 表から引く。
 */
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http';
import { type OperationId, operations } from '../../../../../packages/contracts/api/server';
import type { Principal } from '../../usecase/shared/principal';
import {
  type HttpResponse,
  internalErrorProblem,
  notFoundProblem,
  unauthorizedProblem,
  validationProblem,
} from './problem';

/** アクセストークンを検証して操作主体を返す。検証できなければ null (→ 401) */
export type Authenticator = (headers: IncomingHttpHeaders) => Promise<Principal | null>;

export type OperationHandler = (principal: Principal, body: unknown) => Promise<HttpResponse>;

/** express 互換のミドルウェア (計装など。integrate 段階が結線する) */
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

export interface HttpAppOptions {
  handlers: Partial<Record<OperationId, OperationHandler>>;
  authenticate: Authenticator;
  middlewares?: Middleware[];
  /** 予期しない例外の記録先 (既定は console.error) */
  onUnexpectedError?: (error: unknown) => void;
}

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;

class InvalidJsonError extends Error {}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}

function send(res: ServerResponse, response: HttpResponse): void {
  res.statusCode = response.status;
  res.setHeader('content-type', `${response.contentType}; charset=utf-8`);
  res.end(JSON.stringify(response.body));
}

function resolveOperation(method: string, path: string): OperationId | undefined {
  const entries = Object.entries(operations) as [OperationId, { method: string; path: string }][];
  return entries.find(([, route]) => route.method === method && route.path === path)?.[0];
}

export function createHttpApp(options: HttpAppOptions): RequestListener {
  const onUnexpectedError = options.onUnexpectedError ?? ((error) => console.error(error));

  const dispatch = async (req: IncomingMessage): Promise<HttpResponse> => {
    const method = (req.method ?? 'GET').toUpperCase();
    const path = (req.url ?? '/').split('?')[0] ?? '/';
    const operationId = resolveOperation(method, path);
    const handler = operationId ? options.handlers[operationId] : undefined;
    if (!handler) return notFoundProblem('route_not_found', '指定された操作はありません');

    const principal = await options.authenticate(req.headers);
    if (!principal) return unauthorizedProblem();

    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch (error) {
      if (error instanceof InvalidJsonError) {
        return validationProblem([
          { field: 'body', code: 'format', message: '入力内容を JSON で送ってください' },
        ]);
      }
      throw error;
    }
    return handler(principal, body);
  };

  const handle = (req: IncomingMessage, res: ServerResponse) => {
    dispatch(req)
      .then((response) => send(res, response))
      .catch((error: unknown) => {
        onUnexpectedError(error);
        send(res, internalErrorProblem());
      });
  };

  const middlewares = options.middlewares ?? [];
  return (req, res) => {
    const run = (index: number) => {
      const middleware = middlewares[index];
      if (!middleware) {
        handle(req, res);
        return;
      }
      middleware(req, res, () => run(index + 1));
    };
    run(0);
  };
}
