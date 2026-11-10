import request from 'supertest';
import { describe, expect, it } from 'vitest';
import type { ListRooms } from '../usecase/listRooms';
import type { ReserveRoom } from '../usecase/reserveRoom';
import {
  createViewRoomAvailability,
  type ViewRoomAvailability,
} from '../usecase/viewRoomAvailability';
import {
  type AppLogger,
  CORRELATION_ID_HEADER,
  createHttpApp,
  type TokenVerifier,
  UNMATCHED_ROUTE_HANDLER,
} from './httpApp';

const PATH = '/api/room-availability';
const BODY = { startAt: '2026-11-10T10:00:00+09:00', endAt: '2026-11-10T11:00:00+09:00' };

const verifier: TokenVerifier = {
  async verify(token) {
    return token === 'good' ? 'employee-a' : null;
  },
};

function recordingLogger() {
  const lines: { level: string; fields: Record<string, unknown>; message: string }[] = [];
  const logger: AppLogger = {
    info: (fields, message) => lines.push({ level: 'info', fields, message }),
    warn: (fields, message) => lines.push({ level: 'warn', fields, message }),
    error: (fields, message) => lines.push({ level: 'error', fields, message }),
  };
  return { logger, lines };
}

/** この入口の検査で呼ばれない usecase (呼ばれたら落とす) */
const unusedReserveRoom: ReserveRoom = {
  async execute() {
    throw new Error('予約の usecase は呼ばれない想定');
  },
};
const unusedListRooms: ListRooms = {
  async execute() {
    throw new Error('会議室の一覧の usecase は呼ばれない想定');
  },
};

function appWith(usecase: ViewRoomAvailability, logger = recordingLogger().logger) {
  return createHttpApp({
    viewRoomAvailability: usecase,
    reserveRoom: unusedReserveRoom,
    listRooms: unusedListRooms,
    tokenVerifier: verifier,
    logger,
  });
}

const emptyUsecase: ViewRoomAvailability = {
  async execute() {
    return { ok: true, value: { rooms: [] } };
  },
};

describe('空き状況の照会の HTTP の入口', () => {
  it('トークンを検証できない場合_401のUNAUTHENTICATEDを返しハンドラの名前付きの終わりのログを出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer bad').send(BODY);

    // Assert
    expect([res.status, res.body.code]).toEqual([401, 'UNAUTHENTICATED']);
    expect(lines.find((l) => l.message === '応答を返した')?.fields).toMatchObject({
      handler: 'viewRoomAvailability',
      status: 401,
    });
  });

  it('認証できた要求を受けた場合_相関IDと社員IDとハンドラの名前を持つ始まりのログを1回出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    const starts = lines.filter((l) => l.message === '要求を受けた');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.fields).toMatchObject({
      correlationId: res.headers[CORRELATION_ID_HEADER],
      handler: 'viewRoomAvailability',
      employeeId: 'employee-a',
    });
  });

  it('トークンを検証できない要求を受けた場合_社員IDを持たない始まりのログを1回出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer bad').send(BODY);

    // Assert
    const starts = lines.filter((l) => l.message === '要求を受けた');
    expect(starts).toHaveLength(1);
    expect(starts[0]?.fields).toMatchObject({
      correlationId: res.headers[CORRELATION_ID_HEADER],
      handler: 'viewRoomAvailability',
    });
    expect(starts[0]?.fields.employeeId).toBeUndefined();
  });

  it('トークンの検証器が例外を投げた場合_始まりのログを出して500を返すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const throwingVerifier: TokenVerifier = {
      async verify() {
        throw new Error('鍵の一覧を取れない');
      },
    };
    const app = createHttpApp({
      viewRoomAvailability: emptyUsecase,
      reserveRoom: unusedReserveRoom,
      listRooms: unusedListRooms,
      tokenVerifier: throwingVerifier,
      logger,
    });

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect([res.status, res.body.code]).toEqual([500, 'INTERNAL_ERROR']);
    expect(lines.filter((l) => l.message === '要求を受けた')).toHaveLength(1);
  });

  it('APIの外の要求を受けた場合_始まりのログを1回出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    await request(app).get('/not-api');

    // Assert
    expect(lines.filter((l) => l.message === '要求を受けた')).toHaveLength(1);
  });

  it('契約に無い経路の要求を受けた場合_未定義の経路を示すハンドラの名前を始まりと終わりのログに持たせ404を返すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).get('/api/unknown').set('Authorization', 'Bearer good');

    // Assert
    expect(res.status).toBe(404);
    const start = lines.find((l) => l.message === '要求を受けた');
    const end = lines.find((l) => l.message === '応答を返した');
    expect([start?.fields.handler, end?.fields.handler]).toEqual([
      UNMATCHED_ROUTE_HANDLER,
      UNMATCHED_ROUTE_HANDLER,
    ]);
  });

  it('契約に無い経路でトークンを検証できない場合_未定義の経路を示すハンドラの名前で401の終わりのログを出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).get('/api/unknown');

    // Assert
    expect(res.status).toBe(401);
    expect(lines.find((l) => l.message === '応答を返した')?.fields).toMatchObject({
      handler: UNMATCHED_ROUTE_HANDLER,
      status: 401,
    });
  });

  it('本文がJSONとして読めない場合_400のVALIDATION_ERRORを返すこと', async () => {
    // Arrange
    const app = appWith(emptyUsecase);

    // Act
    const res = await request(app)
      .post(PATH)
      .set('Authorization', 'Bearer good')
      .set('Content-Type', 'application/json')
      .send('{"startAt":');

    // Assert
    expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('本文が読み込みの上限を超える場合_400のVALIDATION_ERRORを返しエラーのログを出さないこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);
    const oversized = JSON.stringify({ ...BODY, padding: 'x'.repeat(200 * 1024) });

    // Act
    const res = await request(app)
      .post(PATH)
      .set('Authorization', 'Bearer good')
      .set('Content-Type', 'application/json')
      .send(oversized);

    // Assert
    expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect(res.body.correlationId).toBe(res.headers[CORRELATION_ID_HEADER]);
    expect(lines.filter((l) => l.level === 'error')).toEqual([]);
  });

  it('本文の文字コードが扱えない場合_400のVALIDATION_ERRORを返しエラーのログを出さないこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app)
      .post(PATH)
      .set('Authorization', 'Bearer good')
      .set('Content-Type', 'application/json; charset=iso-8859-1')
      .send(JSON.stringify(BODY));

    // Assert
    expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_ERROR']);
    expect(lines.filter((l) => l.level === 'error')).toEqual([]);
  });

  it('Content-TypeがJSONでない場合_本文が無いものとして400のVALIDATION_ERRORを返すこと', async () => {
    // Arrange
    const app = appWith(emptyUsecase);

    // Act
    const res = await request(app)
      .post(PATH)
      .set('Authorization', 'Bearer good')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(BODY));

    // Assert
    expect([res.status, res.body.code]).toEqual([400, 'VALIDATION_ERROR']);
  });

  it('開始と終了が同じミリ秒の中で開始が前の場合_1ミリ秒未満を落とさずusecaseに渡しNOT_ON_30_MINUTESの422を返すこと', async () => {
    // Arrange
    const app = appWith(
      createViewRoomAvailability({
        repository: {
          listRooms: async () => [],
          listReservations: async () => [],
        },
      }),
    );

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send({
      startAt: '2026-11-10T10:00:00.0001+09:00',
      endAt: '2026-11-10T10:00:00.0005+09:00',
    });

    // Assert
    expect([res.status, res.body.code]).toEqual([422, 'NOT_ON_30_MINUTES']);
  });

  it('usecaseが業務のエラーを返した場合_422の契約のProblemで返すこと', async () => {
    // Arrange
    const app = appWith({
      async execute() {
        return { ok: false, error: { code: 'NOT_ON_30_MINUTES' } };
      },
    });

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: 'about:blank',
      title: '時刻は 30 分刻みで指定してください',
      status: 422,
      detail: '開始と終了の時刻は 0 分か 30 分ちょうどにしてください',
      code: 'NOT_ON_30_MINUTES',
      correlationId: res.headers[CORRELATION_ID_HEADER],
    });
  });

  it('usecaseが日をまたぐ時間帯の業務のエラーを返した場合_理由に合う直し方をdetailに載せた422を返すこと', async () => {
    // Arrange
    const app = appWith({
      async execute() {
        return { ok: false, error: { code: 'INVALID_TIME_RANGE', reason: 'OUTSIDE_BUSINESS_DAY' } };
      },
    });

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect([res.status, res.body.code, res.body.detail]).toEqual([
      422,
      'INVALID_TIME_RANGE',
      '時間帯は開始の日付の 0:00 から翌日 0:00 までに収めてください (日をまたぐ時間帯は指定できません)',
    ]);
  });

  it('usecaseが開始が終了より前でない業務のエラーを返した場合_理由に合う直し方をdetailに載せた422を返すこと', async () => {
    // Arrange
    const app = appWith({
      async execute() {
        return { ok: false, error: { code: 'INVALID_TIME_RANGE', reason: 'START_NOT_BEFORE_END' } };
      },
    });

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect([res.status, res.body.code, res.body.detail]).toEqual([
      422,
      'INVALID_TIME_RANGE',
      '開始の日時を終了の日時より前にしてください',
    ]);
  });

  it('usecaseが例外を投げた場合_500で汎用の文と相関IDだけを返しエラーのログを出すこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(
      {
        async execute() {
          throw new Error('SELECT failed: connection refused');
        },
      },
      logger,
    );

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('SELECT');
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(
      lines.some((l) => l.level === 'error' && l.fields.handler === 'viewRoomAvailability'),
    ).toBe(true);
  });

  it('要求を受けた場合_相関IDと社員IDとハンドラの名前を持つ終わりのログを出しCORSのヘッダを返さないこと', async () => {
    // Arrange
    const { logger, lines } = recordingLogger();
    const app = appWith(emptyUsecase, logger);

    // Act
    const res = await request(app).post(PATH).set('Authorization', 'Bearer good').send(BODY);

    // Assert
    const end = lines.find((l) => l.message === '応答を返した');
    expect(end?.fields).toMatchObject({
      correlationId: res.headers[CORRELATION_ID_HEADER],
      employeeId: 'employee-a',
      handler: 'viewRoomAvailability',
      status: 200,
    });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
