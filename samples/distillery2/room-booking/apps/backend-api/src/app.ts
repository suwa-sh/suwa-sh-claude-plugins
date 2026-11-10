// composition root。各層の部品を作って結ぶ (ADR 0013)。本番は createProductionApp、テストは src/test-app.ts が buildApp を使う。
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import pino from 'pino';
import { createJoseTokenVerifier } from './gateway/joseTokenVerifier';
import { type AppLogger, createHttpApp, type TokenVerifier } from './presentation/httpApp';
import { createReservationRepository } from './repository/reservationRepository';
import { createRoomAvailabilityRepository } from './repository/roomAvailabilityRepository';
import type { SqlClient } from './repository/sqlClient';
import { createListRooms } from './usecase/listRooms';
import { type Clock, createReserveRoom, type ReserveRoomRepository } from './usecase/reserveRoom';
import {
  createViewRoomAvailability,
  type RoomAvailabilityRepository,
} from './usecase/viewRoomAvailability';

/** 図の参加者にする層 (integrate が traced() で包むため、各層の境界オブジェクトをこれに通す) */
export type Layer = 'usecase' | 'repository' | 'gateway';
export type Decorate = <T extends object>(name: string, obj: T, layer: Layer) => T;

const asIs: Decorate = (_name, obj) => obj;

export interface BuildAppDeps {
  db: SqlClient;
  tokenVerifier: TokenVerifier;
  logger: AppLogger;
  /** 時計 (省略時は systemClock。テストは固定の時計を渡す) */
  clock?: Clock;
  decorate?: Decorate;
}

/** 本番の時計 (ADR 0009: 現在時刻は Clock から得る。new Date() を書くのは composition root だけ) */
export const systemClock: Clock = { now: () => new Date() };

export function buildApp(deps: BuildAppDeps) {
  const decorate = deps.decorate ?? asIs;
  const clock = deps.clock ?? systemClock;
  const repository: RoomAvailabilityRepository = decorate(
    'RoomAvailabilityRepository',
    createRoomAvailabilityRepository(deps.db),
    'repository',
  );
  const reservationRepository: ReserveRoomRepository = decorate(
    'ReservationRepository',
    createReservationRepository(deps.db, { newEventId: randomUUID }),
    'repository',
  );
  const viewRoomAvailability = decorate(
    'ViewRoomAvailability',
    createViewRoomAvailability({ repository, logger: deps.logger }),
    'usecase',
  );
  const reserveRoom = decorate(
    'ReserveRoom',
    createReserveRoom({
      repository: reservationRepository,
      clock,
      newReservationId: randomUUID,
      logger: deps.logger,
    }),
    'usecase',
  );
  const listRooms = decorate('ListRooms', createListRooms({ repository }), 'usecase');
  const tokenVerifier = decorate('TokenVerifier', deps.tokenVerifier, 'gateway');
  return createHttpApp({
    viewRoomAvailability,
    reserveRoom,
    listRooms,
    tokenVerifier,
    logger: deps.logger,
  });
}

/** 本番の設定 (環境ごとに変える値。ADR 0015: 発行者・宛先・鍵の一覧の場所は環境ごとの設定) */
export interface ProductionConfig {
  databaseUrl: string;
  oidcIssuer: string;
  oidcAudience: string;
  oidcJwksUri: string;
}

export function productionConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ProductionConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value) throw new Error(`環境変数 ${name} が設定されていない`);
    return value;
  };
  return {
    databaseUrl: required('DATABASE_URL'),
    oidcIssuer: required('OIDC_ISSUER'),
    oidcAudience: required('OIDC_AUDIENCE'),
    oidcJwksUri: required('OIDC_JWKS_URI'),
  };
}

/** 本番の入口。実際の DB とアクセストークン (JWT) の検証器を渡す。テスト用のトークンは受け付けない */
export function createProductionApp(config: ProductionConfig) {
  const logger = pino();
  const pool = new pg.Pool({ connectionString: config.databaseUrl });
  const db: SqlClient = {
    query: async <T>(text: string, params?: unknown[]) => {
      const res = await pool.query(text, params);
      return { rows: res.rows as T[] };
    },
  };
  const tokenVerifier = createJoseTokenVerifier(
    {
      issuer: config.oidcIssuer,
      audience: config.oidcAudience,
      jwksUri: config.oidcJwksUri,
    },
    logger,
  );
  return buildApp({ db, tokenVerifier, logger });
}
