// 要求の本文 (契約 TimeRange) の形の検証。形の誤りは 400 VALIDATION_ERROR にし、業務のエラーと混ぜない (ADR 0023)。
// 業務の規則 (順・30 分刻み・日付に収まる) はここで見ない (domain の時間帯が見る)。
import type { PreciseInstant } from '../domain/timeRange';

/**
 * 時差付きの RFC 3339 の日時 (契約 DateTime の format date-time)。時差の省略を受けない。
 * 時は 00〜23 だけを受け、24:00 の表記は受けない (ADR 0017: 終了の 24:00 は翌日 0:00 の日時で持つ)
 */
const RFC3339_DATE_TIME =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])[Tt]([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?([Zz]|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

const TIME_RANGE_KEYS = ['startAt', 'endAt'] as const;

/**
 * 本文を時間帯の開始と終了に読む。契約の形に合わなければ null。
 * 1 ミリ秒未満の数字も落とさずに渡す (Date は切り捨てるので、順と 30 分刻みの判定を domain が全精度で行えるようにする)
 */
export function parseTimeRangeBody(
  body: unknown,
): { startAt: PreciseInstant; endAt: PreciseInstant } | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  // additionalProperties: false
  if (Object.keys(record).some((k) => !(TIME_RANGE_KEYS as readonly string[]).includes(k))) {
    return null;
  }
  const startAt = parseDateTime(record.startAt);
  const endAt = parseDateTime(record.endAt);
  if (!startAt || !endAt) return null;
  return { startAt, endAt };
}

/** 契約 DateTime の 1 つの値を読む。形に合わなければ null (予約の要求の本文でも使う) */
export function parseDateTime(value: unknown): PreciseInstant | null {
  if (typeof value !== 'string' || !RFC3339_DATE_TIME.test(value)) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  // 2026-02-30 のように暦に無い日付は Date が繰り上げるので、日付の部分が読み直して同じかで弾く
  if (!sameCalendarDate(value, parsed)) return null;
  // Date は小数の秒の 4 桁目以降を切り捨てる (10:00:00.0001 は 10:00:00.000)。切り捨てた分の数字を別に持つ
  const fraction = /\.(\d+)/.exec(value)?.[1] ?? '';
  return { epochMs: parsed.getTime(), subMillisecondDigits: fraction.slice(3) };
}

function sameCalendarDate(text: string, parsed: Date): boolean {
  const offset = /([Zz]|([+-])(\d{2}):(\d{2}))$/.exec(text);
  if (!offset) return false;
  const sign = offset[2] === '-' ? -1 : 1;
  const offsetMs =
    offset[1].toUpperCase() === 'Z'
      ? 0
      : sign * (Number(offset[3]) * 60 + Number(offset[4])) * 60_000;
  const local = new Date(parsed.getTime() + offsetMs).toISOString().slice(0, 10);
  return local === text.slice(0, 10);
}
