// HTTP の入口 (Express)。経路は契約の生成物 (operationId ↔ method/path) から引く。
// 認証 → 本文の形の検証 → usecase → 契約の型で応答、の順に通す。CORS は入れない (ADR 0021)。
import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { operations } from '../../../../packages/contracts/api/server';
import type {
  Reservation,
  RoomAvailabilityList,
  RoomList,
} from '../../../../packages/contracts/api/types';
import { EmployeeId } from '../domain/ids';
import type { ListRooms } from '../usecase/listRooms';
import type { ReserveRoom } from '../usecase/reserveRoom';
import type { ViewRoomAvailability } from '../usecase/viewRoomAvailability';
import { formatBusinessDateTime } from './businessDateTime';
import { sendBusinessError, sendProblem } from './problem';
import { parseReserveRoomBody } from './reserveRoomRequest';
import { parseTimeRangeBody } from './timeRangeRequest';

/** ログに載せる要求の文脈 (ADR 0011) */
export interface LogContext {
  correlationId?: string;
  handler?: string;
}

/**
 * アクセストークンの検証器の口 (ADR 0006。gateway の実装を composition root が渡す)。
 * 検証できたら sub、トークンが合わなければ null (401)。認証基盤の障害 (鍵の一覧を取れない等) は例外を投げる (500。ADR 0023)
 */
export interface TokenVerifier {
  verify(token: string, context?: LogContext): Promise<string | null>;
}

/** 構造化ログの口 (ADR 0011。pino の logger がこの形を満たす) */
export interface AppLogger {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
}

export interface HttpAppDeps {
  viewRoomAvailability: ViewRoomAvailability;
  reserveRoom: ReserveRoom;
  listRooms: ListRooms;
  tokenVerifier: TokenVerifier;
  logger: AppLogger;
}

/** 相関 ID を返す応答のヘッダ */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

interface RequestLocals {
  correlationId: string;
  handler?: string;
  employeeId?: EmployeeId;
  startLogged?: boolean;
}

const localsOf = (res: Response): RequestLocals => res.locals as RequestLocals;

const BEARER = /^Bearer\s+(\S+)$/i;

/**
 * 契約に無い経路の要求のログに載せるハンドラの名前 (ADR 0011 はログにハンドラの名前を必ず持たせる)。
 * 契約の operationId と重ならない名前にする
 */
export const UNMATCHED_ROUTE_HANDLER = 'unmatchedRoute';

/** 要求の method と path から契約の operationId (ハンドラの名前) を引く。契約に無い要求は UNMATCHED_ROUTE_HANDLER */
function handlerOf(method: string, path: string): string {
  return (
    Object.entries(operations).find(
      ([, op]) => op.method === method.toUpperCase() && op.path === path,
    )?.[0] ?? UNMATCHED_ROUTE_HANDLER
  );
}

export function createHttpApp(deps: HttpAppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');

  // 要求の始まりのログ。社員が特定できる要求では社員 ID も持たせる (ADR 0011) ため、
  // /api ではトークンの検証の後 (成否どちらでも) に 1 回だけ出す
  const logRequestStart = (req: Request, res: Response): void => {
    const locals = localsOf(res);
    if (locals.startLogged) return;
    locals.startLogged = true;
    deps.logger.info(
      {
        correlationId: locals.correlationId,
        handler: locals.handler,
        employeeId: locals.employeeId?.value,
        method: req.method,
        path: req.path,
      },
      '要求を受けた',
    );
  };

  // 相関 ID・ハンドラの名前と、要求の終わりのログ
  app.use((req: Request, res: Response, next: NextFunction) => {
    const locals = localsOf(res);
    const correlationId = randomUUID();
    locals.correlationId = correlationId;
    locals.handler = handlerOf(req.method, req.path);
    res.setHeader(CORRELATION_ID_HEADER, correlationId);
    const startedAt = performance.now();
    res.on('finish', () => {
      deps.logger.info(
        {
          correlationId,
          handler: locals.handler,
          employeeId: locals.employeeId?.value,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
        },
        '応答を返した',
      );
    });
    next();
  });

  // すべての API でトークンを検証する (ADR 0006)。本文の形より先に見る
  app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
    const locals = localsOf(res);
    const token = BEARER.exec(req.get('authorization') ?? '')?.[1];
    let sub: string | null = null;
    try {
      sub = token
        ? await deps.tokenVerifier.verify(token, {
            correlationId: locals.correlationId,
            handler: locals.handler,
          })
        : null;
    } catch (error) {
      // 検証器の例外 (認証基盤の障害・想定外) は、始まりのログを残してから共通のエラーの処理 (500) に回す
      logRequestStart(req, res);
      throw error;
    }
    const employeeId = EmployeeId.fromSubject(sub);
    if (employeeId) locals.employeeId = employeeId;
    logRequestStart(req, res);
    if (!employeeId) {
      sendProblem(res, 'UNAUTHENTICATED', { correlationId: locals.correlationId });
      return;
    }
    next();
  });

  // /api の外の要求 (トークンを見ない) は、ここで始まりのログを出す
  app.use((req: Request, res: Response, next: NextFunction) => {
    logRequestStart(req, res);
    next();
  });

  app.use(express.json());

  app.post(operations.viewRoomAvailability.path, async (req: Request, res: Response) => {
    const locals = localsOf(res);
    const range = parseTimeRangeBody(req.body);
    if (!range) {
      sendProblem(res, 'VALIDATION_ERROR', { correlationId: locals.correlationId });
      return;
    }
    const result = await deps.viewRoomAvailability.execute(range, {
      correlationId: locals.correlationId,
      handler: locals.handler,
      employeeId: locals.employeeId?.value,
    });
    if (!result.ok) {
      sendBusinessError(res, result.error, locals.correlationId);
      return;
    }
    const body: RoomAvailabilityList = { rooms: result.value.rooms };
    res.status(200).json(body);
  });

  app.get(operations.listRooms.path, async (_req: Request, res: Response) => {
    const result = await deps.listRooms.execute();
    const body: RoomList = {
      rooms: result.rooms.map((room) => ({ roomId: room.roomId, name: room.name })),
    };
    res.status(200).json(body);
  });

  app.post(operations.reserveRoom.path, async (req: Request, res: Response) => {
    const locals = localsOf(res);
    // 予約者は本文で受けず、トークンの社員にする (ADR 0006)。認証の層を通った要求には必ずある
    if (!locals.employeeId) {
      sendProblem(res, 'UNAUTHENTICATED', { correlationId: locals.correlationId });
      return;
    }
    const parsed = parseReserveRoomBody(req.body);
    if (!parsed) {
      sendProblem(res, 'VALIDATION_ERROR', { correlationId: locals.correlationId });
      return;
    }
    const result = await deps.reserveRoom.execute(
      { ...parsed, employeeId: locals.employeeId },
      {
        correlationId: locals.correlationId,
        handler: locals.handler,
        employeeId: locals.employeeId.value,
      },
    );
    if (!result.ok) {
      sendBusinessError(res, result.error, locals.correlationId);
      return;
    }
    const { kind, reservation } = result.value;
    const body: Reservation = {
      reservationId: reservation.reservationId,
      roomId: reservation.roomId,
      roomName: reservation.roomName,
      startAt: formatBusinessDateTime(reservation.startAt),
      endAt: formatBusinessDateTime(reservation.endAt),
      reservedBy: reservation.reservedBy,
      status: reservation.status,
    };
    // 新しく成立したら 201、送り直しで成立済みの予約を返すなら 200 (本文は同じ形。契約 reserveRoom)
    res.status(kind === 'resent' ? 200 : 201).json(body);
  });

  // 本文の読み込みで要求の側に原因がある失敗 (JSON として読めない・大きすぎる・扱えない文字コードや圧縮・途中で切れた) は
  // 形の誤り (400)。それ以外はシステムのエラー (500。汎用の文と相関 ID だけ返す)
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const locals = localsOf(res);
    if (isClientBodyReadError(error)) {
      sendProblem(res, 'VALIDATION_ERROR', { correlationId: locals.correlationId });
      return;
    }
    deps.logger.error(
      {
        correlationId: locals.correlationId,
        handler: locals.handler,
        employeeId: locals.employeeId?.value,
        err: error,
      },
      'システムのエラーで応答できなかった',
    );
    sendProblem(res, 'INTERNAL_ERROR', { correlationId: locals.correlationId });
  });

  return app;
}

/**
 * express.json (body-parser・raw-body) の読み込みの失敗のうち、要求の側に原因があるもの。
 * これらは type (entity.parse.failed・entity.too.large・charset.unsupported・encoding.unsupported・
 * request.aborted・request.size.invalid) と 4xx の status を持つ。5xx (stream.*) はサーバ側の失敗なので含めない
 */
function isClientBodyReadError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { type, status } = error as { type?: unknown; status?: unknown };
  return typeof type === 'string' && typeof status === 'number' && status >= 400 && status < 500;
}
