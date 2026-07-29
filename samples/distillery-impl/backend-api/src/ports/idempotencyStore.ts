// 出典: _cross-cutting/datastore/kvs-schema.yaml key_patterns "idempotency:{idempotency_key}"
// KVS の実体は本 UC のスコープ外(has_kvs: true だが本 tier では抽象化のみ提供)。
// 実運用の Redis/ElastiCache 接続実装は別途 issues/ の変更要求に従い差し替える。

export interface IdempotencyStore {
  has(key: string): boolean;
  put(key: string): void;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly keys = new Set<string>();

  has(key: string): boolean {
    return this.keys.has(key);
  }

  put(key: string): void {
    this.keys.add(key);
  }
}
