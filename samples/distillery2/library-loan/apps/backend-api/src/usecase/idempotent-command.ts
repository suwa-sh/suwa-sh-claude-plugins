/**
 * 更新系 API の Idempotency-Key の扱い (ADR 0005、契約 parameters/IdempotencyKey と idempotency_keys)。
 *
 * 同じキー・同じ本文の再送には初回の応答をそのまま返し、副作用を重複させない。
 * 業務判定と応答の保存は 1 トランザクションで行う
 * (AssumptionRecord: register-loan の A-005、register-return の A-104)。
 */
import { createHash } from 'node:crypto';
import type { Clock, IdempotencyRepository, IdempotencyScope, UnitOfWork } from './ports';

/** 利用者に返す応答 (契約 idempotency_keys の response_status / response_body と同じ形) */
export type RecordedResponse = { status: number; body: string | null };

export type IdempotentOutcome<D> =
  | { kind: 'decided'; decision: D; response: RecordedResponse }
  | { kind: 'replayed'; response: RecordedResponse }
  | { kind: 'idempotency_key_conflict'; idempotencyKey: string };

export type IdempotentCommandDeps = {
  unitOfWork: UnitOfWork;
  idempotency: IdempotencyRepository;
  clock: Clock;
};

export type IdempotentCommand<D> = {
  scope: IdempotencyScope;
  /** 同じキーで本文が異なる再送を見分けるための要求本文のハッシュ */
  requestHash: string;
  /** 業務判定と更新。トランザクションの中で呼ばれる */
  decide(now: Date): Promise<D>;
  /** 判定結果を応答に変換する */
  render(decision: D): RecordedResponse;
};

/** 要求本文を決まった順の JSON にしてから SHA-256 を取る (AssumptionRecord A-005) */
export function hashRequest(canonical: Record<string, string>): string {
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function runIdempotently<D>(
  deps: IdempotentCommandDeps,
  command: IdempotentCommand<D>,
): Promise<IdempotentOutcome<D>> {
  return deps.unitOfWork.run<IdempotentOutcome<D>>(async () => {
    const stored = await deps.idempotency.find(command.scope);
    if (stored) {
      if (stored.requestHash !== command.requestHash) {
        return { kind: 'idempotency_key_conflict', idempotencyKey: command.scope.idempotencyKey };
      }
      // 同じキーの再送には、成功・拒否を問わず初回の応答をそのまま返す (契約 parameters/IdempotencyKey)
      return {
        kind: 'replayed',
        response: { status: stored.responseStatus, body: stored.responseBody },
      };
    }

    const now = deps.clock.now();
    const decision = await command.decide(now);
    // 拒否 (409) や書籍不在 (404) の応答も、更新と同じトランザクションで保存する (AssumptionRecord A-005)
    const response = command.render(decision);
    await deps.idempotency.save(
      command.scope,
      {
        requestHash: command.requestHash,
        responseStatus: response.status,
        responseBody: response.body,
      },
      now,
    );
    return { kind: 'decided', decision, response };
  });
}
