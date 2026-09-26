/** 時計と ID 採番の実装。テストでは固定の時計に差し替える (ADR 0007) */
import { randomUUID } from 'node:crypto';

export const systemClock = {
  now: (): Date => new Date(),
};

export function fixedClock(instant: Date) {
  return {
    now: (): Date => new Date(instant.getTime()),
  };
}

export const uuidGenerator = {
  newId: (): string => randomUUID(),
};
