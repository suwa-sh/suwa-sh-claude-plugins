/** 成功か業務のエラーかを戻り値で返す (ADR 0023。domain と usecase は業務のエラーを例外で投げない) */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): { ok: true; value: T } => ({ ok: true, value });

export const err = <E>(error: E): { ok: false; error: E } => ({ ok: false, error });
