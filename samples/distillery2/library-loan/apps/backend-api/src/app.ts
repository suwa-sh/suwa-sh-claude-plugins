/**
 * backend-api の composition root。各レイヤのオブジェクトを組み立て、node:http の request listener を返す。
 * usecase / repository は decorate を通して組み立てる (integrate 段階が traced() を差し込む入口)。
 */
import type { Clock, IdGenerator } from './domain/shared/clock';
import type { Database } from './gateway/database';
import { createLoanHandler } from './presentation/circulation/createLoanHandler';
import {
  type Authenticator,
  createHttpApp,
  type Middleware,
  type RequestListener,
} from './presentation/http/server';
import { createPgLoanRepository } from './repository/circulation/pgLoanRepository';
import { createPgPatronRepository } from './repository/patron/pgPatronRepository';
import { createRegisterLoan } from './usecase/circulation/registerLoan';
import { createFindPatronByNumber } from './usecase/patron/findPatronByNumber';

export type Layer = 'usecase' | 'repository' | 'gateway';
export type Decorate = <T extends object>(name: string, obj: T, layer: Layer) => T;

export interface AppDeps {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  authenticate: Authenticator;
  decorate?: Decorate;
  middlewares?: Middleware[];
  onUnexpectedError?: (error: unknown) => void;
}

const identity: Decorate = (_name, obj) => obj;

export function createApp(deps: AppDeps): RequestListener {
  const decorate = deps.decorate ?? identity;

  const patronRepository = decorate(
    'PatronRepository',
    createPgPatronRepository(deps.db),
    'repository',
  );
  const loanRepository = decorate(
    'LoanRepository',
    createPgLoanRepository(deps.db, deps.ids),
    'repository',
  );
  const findPatronByNumber = decorate(
    'FindPatronByNumber',
    createFindPatronByNumber(patronRepository),
    'usecase',
  );
  const registerLoan = decorate(
    'RegisterLoan',
    createRegisterLoan({
      loans: loanRepository,
      findPatronByNumber,
      clock: deps.clock,
      ids: deps.ids,
    }),
    'usecase',
  );

  return createHttpApp({
    handlers: { createLoan: createLoanHandler(registerLoan) },
    authenticate: deps.authenticate,
    middlewares: deps.middlewares,
    onUnexpectedError: deps.onUnexpectedError,
  });
}
