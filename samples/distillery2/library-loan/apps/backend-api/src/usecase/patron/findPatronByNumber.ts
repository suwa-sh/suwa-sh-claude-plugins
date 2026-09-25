/**
 * patron モジュールが公開する usecase。他モジュール (circulation) は利用者をこの入口経由で引く (ADR 0009)。
 */
import type { Patron, PatronRepository } from '../../domain/patron/patron';

export interface FindPatronByNumber {
  execute(patronNumber: string): Promise<Patron | null>;
}

export function createFindPatronByNumber(patrons: PatronRepository): FindPatronByNumber {
  return {
    execute: (patronNumber) => patrons.findActiveByPatronNumber(patronNumber),
  };
}
