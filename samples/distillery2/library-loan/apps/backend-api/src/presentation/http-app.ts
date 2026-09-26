/**
 * HTTP の入口 (presentation)。Node 標準の http で受け、経路は契約の生成物 (server.ts の operations) で引く。
 * HTTP 固有の型はこの層に閉じ込め、usecase には契約型と Principal だけを渡す (ADR 0002)。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { operations } from '../../../../packages/contracts/library-api/server';
import type { Problem } from '../../../../packages/contracts/library-api/types';
import type { Principal, TokenVerifier } from '../usecase/ports';
import type { RecordedResponse, RegisterLoan, RegisterLoanOutcome } from '../usecase/register-loan';
import { problem } from './problem';
import { validateIdempotencyKey, validateRegisterLoanRequest } from './register-loan-request';

export type RequestListener = (req: IncomingMessage, res: ServerResponse) => void;
/** 計装などを差し込むためのミドルウェア (express 互換の (req, res, next)) */
export type Middleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

export type HttpAppDeps = {
  registerLoan: RegisterLoan;
  tokenVerifier: TokenVerifier;
  middlewares?: Middleware[];
  onError?: (error: unknown) => void;
};

const JSON_CONTENT_TYPE = 'application/json';
const PROBLEM_CONTENT_TYPE = 'application/problem+json';
const BEARER_PREFIX = 'Bearer ';

class InvalidJsonError extends Error {}

function sendProblem(res: ServerResponse, body: Problem): void {
  res.writeHead(body.status, { 'content-type': `${PROBLEM_CONTENT_TYPE}; charset=utf-8` });
  res.end(JSON.stringify(body));
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new InvalidJsonError();
  }
}

async function authenticate(
  req: IncomingMessage,
  verifier: TokenVerifier,
): Promise<Principal | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return verifier.verify(header.slice(BEARER_PREFIX.length).trim());
}

/** usecase が保存・再生する応答 (本文は JSON 文字列のまま) を送る */
function sendRecorded(res: ServerResponse, response: RecordedResponse): void {
  const contentType = response.status >= 400 ? PROBLEM_CONTENT_TYPE : JSON_CONTENT_TYPE;
  if (response.body === null) {
    res.writeHead(response.status);
    res.end();
    return;
  }
  res.writeHead(response.status, { 'content-type': `${contentType}; charset=utf-8` });
  res.end(response.body);
}

function toResponse(res: ServerResponse, outcome: RegisterLoanOutcome): void {
  switch (outcome.kind) {
    case 'decided':
    case 'replayed':
      sendRecorded(res, outcome.response);
      return;
    case 'forbidden':
      sendProblem(res, problem('forbidden', { detail: '貸出の登録は司書だけが行えます' }));
      return;
    case 'idempotency_key_conflict':
      sendProblem(
        res,
        problem('idempotency_key_conflict', {
          detail: `Idempotency-Key ${outcome.idempotencyKey} はすでに別の内容の要求に使われています`,
        }),
      );
      return;
  }
}

async function handleRegisterLoan(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpAppDeps,
): Promise<void> {
  // 認証 (401) を本文・Idempotency-Key の入力検証 (400) より先に判定する (AssumptionRecord A-012)
  const principal = await authenticate(req, deps.tokenVerifier);
  if (!principal) {
    sendProblem(
      res,
      problem('unauthorized', { detail: '有効なアクセストークンを指定してください' }),
    );
    return;
  }
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof InvalidJsonError) {
      sendProblem(
        res,
        problem('validation_error', {
          errors: [{ field: 'body', message: '要求本文を JSON として読めません' }],
        }),
      );
      return;
    }
    throw error;
  }
  const request = validateRegisterLoanRequest(body);
  const idempotencyKey = validateIdempotencyKey(req.headers['idempotency-key']);
  const errors = [
    ...(request.ok ? [] : request.errors),
    ...(idempotencyKey.ok ? [] : idempotencyKey.errors),
  ];
  if (!request.ok || !idempotencyKey.ok) {
    sendProblem(res, problem('validation_error', { errors }));
    return;
  }
  const outcome = await deps.registerLoan.execute({
    principal,
    idempotencyKey: idempotencyKey.value,
    request: request.value,
  });
  toResponse(res, outcome);
}

async function route(req: IncomingMessage, res: ServerResponse, deps: HttpAppDeps): Promise<void> {
  const path = (req.url ?? '/').split('?')[0];
  const { registerLoan } = operations;
  if (req.method === registerLoan.method && path === registerLoan.path) {
    await handleRegisterLoan(req, res, deps);
    return;
  }
  sendProblem(res, problem('not_found', { detail: `${req.method} ${path} は提供していません` }));
}

function runMiddlewares(
  middlewares: Middleware[],
  req: IncomingMessage,
  res: ServerResponse,
  last: () => void,
): void {
  const [head, ...rest] = middlewares;
  if (!head) {
    last();
    return;
  }
  head(req, res, () => runMiddlewares(rest, req, res, last));
}

export function createHttpApp(deps: HttpAppDeps): RequestListener {
  return (req, res) => {
    runMiddlewares(deps.middlewares ?? [], req, res, () => {
      route(req, res, deps).catch((error: unknown) => {
        deps.onError?.(error);
        if (!res.headersSent) {
          sendProblem(res, problem('internal_error'));
        }
      });
    });
  };
}
