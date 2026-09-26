/**
 * backend-api の composition root。各レイヤのオブジェクトを組み立て、HTTP の入口 (RequestListener) を返す。
 * usecase / repository / gateway は `decorate` を通してから結線する (計装で包めるようにするため)。
 */
import { LIBRARY_TIME_ZONE, LOAN_PERIOD_DAYS } from './domain/loan/loan-policy';
import { systemClock, uuidGenerator } from './gateway/system';
import { createHttpApp, type Middleware, type RequestListener } from './presentation/http-app';
import { registerLoanResponder } from './presentation/register-loan-response';
import { registerReturnResponder } from './presentation/register-return-response';
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
import { createRegisterReturn } from './usecase/register-return';

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
  const unitOfWork = decorate('UnitOfWork', { run: db.run }, 'repository');
  const books = decorate('BookRepository', createPgBookRepository(db), 'repository');
  const reservations = decorate(
    'ReservationRepository',
    createPgReservationRepository(db),
    'repository',
  );
  const loans = decorate('LoanRepository', createPgLoanRepository(db), 'repository');
  const idempotency = decorate(
    'IdempotencyRepository',
    createPgIdempotencyRepository(db),
    'repository',
  );
  const clock = deps.clock ?? systemClock;
  const timeZone = deps.timeZone ?? LIBRARY_TIME_ZONE;

  const registerLoan = decorate(
    'RegisterLoan',
    createRegisterLoan({
      responder: registerLoanResponder,
      unitOfWork,
      books,
      patrons: decorate('PatronRepository', createPgPatronRepository(db), 'repository'),
      reservations,
      loans,
      idempotency,
      clock,
      ids: deps.ids ?? uuidGenerator,
      loanPeriodDays: deps.loanPeriodDays ?? LOAN_PERIOD_DAYS,
      timeZone,
    }),
    'usecase',
  );
  const registerReturn = decorate(
    'RegisterReturn',
    createRegisterReturn({
      responder: registerReturnResponder,
      unitOfWork,
      books,
      loans,
      reservations,
      idempotency,
      clock,
      timeZone,
    }),
    'usecase',
  );
  return createHttpApp({
    registerLoan,
    registerReturn,
    tokenVerifier: decorate('TokenVerifier', deps.tokenVerifier, 'gateway'),
    middlewares: deps.middlewares,
    onError: deps.onError,
  });
}
