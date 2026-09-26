/**
 * backend-api の composition root。各レイヤのオブジェクトを組み立て、HTTP の入口 (RequestListener) を返す。
 * usecase / repository / gateway は `decorate` を通してから結線する (計装で包めるようにするため)。
 */
import { LIBRARY_TIME_ZONE, LOAN_PERIOD_DAYS } from './domain/loan/loan-policy';
import { systemClock, uuidGenerator } from './gateway/system';
import { createHttpApp, type Middleware, type RequestListener } from './presentation/http-app';
import { registerLoanResponder } from './presentation/register-loan-response';
import { createDbContext, type SqlDatabase } from './repository/db-context';
import {
  createPgBookRepository,
  createPgIdempotencyRepository,
  createPgLoanRepository,
  createPgPatronRepository,
  createPgReservationRepository,
} from './repository/pg-loan-repositories';
import type { Clock, IdGenerator, TokenVerifier } from './usecase/ports';
import { createRegisterLoan } from './usecase/register-loan';

export type Layer = 'usecase' | 'repository' | 'gateway';
export type Decorate = <T extends object>(name: string, obj: T, layer: Layer) => T;

export type AppDeps = {
  database: SqlDatabase;
  tokenVerifier: TokenVerifier;
  clock?: Clock;
  ids?: IdGenerator;
  loanPeriodDays?: number;
  timeZone?: string;
  decorate?: Decorate;
  middlewares?: Middleware[];
  onError?: (error: unknown) => void;
};

const identity: Decorate = (_name, obj) => obj;

export function createApp(deps: AppDeps): RequestListener {
  const decorate = deps.decorate ?? identity;
  const db = createDbContext(deps.database);
  const registerLoan = decorate(
    'RegisterLoan',
    createRegisterLoan({
      responder: registerLoanResponder,
      unitOfWork: decorate('UnitOfWork', { run: db.run }, 'repository'),
      books: decorate('BookRepository', createPgBookRepository(db), 'repository'),
      patrons: decorate('PatronRepository', createPgPatronRepository(db), 'repository'),
      reservations: decorate(
        'ReservationRepository',
        createPgReservationRepository(db),
        'repository',
      ),
      loans: decorate('LoanRepository', createPgLoanRepository(db), 'repository'),
      idempotency: decorate(
        'IdempotencyRepository',
        createPgIdempotencyRepository(db),
        'repository',
      ),
      clock: deps.clock ?? systemClock,
      ids: deps.ids ?? uuidGenerator,
      loanPeriodDays: deps.loanPeriodDays ?? LOAN_PERIOD_DAYS,
      timeZone: deps.timeZone ?? LIBRARY_TIME_ZONE,
    }),
    'usecase',
  );
  return createHttpApp({
    registerLoan,
    tokenVerifier: decorate('TokenVerifier', deps.tokenVerifier, 'gateway'),
    middlewares: deps.middlewares,
    onError: deps.onError,
  });
}
