/**
 * 更新系 API (貸出・返却) の再送判定キー (Idempotency-Key。ADR 0005) を画面操作で扱う規則。
 * 契約 components.parameters.IdempotencyKey の制約は 1〜128 文字。
 */

/** 再送判定キーを作る */
export const newIdempotencyKey = (): string => globalThis.crypto.randomUUID();

/**
 * 登録操作の結果から、次の送信で使う再送判定キーを決める。
 * 結果が確定した応答 (登録済み・受け付けられない) の後は新しいキーにし、状況が変わった後の再試行を初回と同じ応答にしない。
 * 結果が不確かな失敗 (通信できない・契約外の応答) の後は同じキーのままにし、再送で登録が重複しないようにする。
 */
export const nextIdempotencyKey = (view: { kind: string }, currentKey: string): string =>
  view.kind === 'failed' ? currentKey : newIdempotencyKey();
