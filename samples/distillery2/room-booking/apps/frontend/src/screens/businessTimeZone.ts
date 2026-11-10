/**
 * 業務のタイムゾーン Asia/Tokyo の時差の規則 (契約 info.description・docs/rules/tier-backend.md)。
 * 時差は固定にしない。tz データベースの Asia/Tokyo には 1948〜1951 年の夏時間 (+10:00) と
 * 1888 年より前の地方時 (+09:18:59) があり、API はこの規則で日付と 30 分刻みを判定する。
 */
export const BUSINESS_TIME_ZONE = 'Asia/Tokyo';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

/** Asia/Tokyo の暦の日時 (年は西暦。紀元前は 0 以下) */
export interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  era: 'short',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/** 暦の日時を、UTC の時刻とみなしたミリ秒にする (年 0〜99 を 1900 年代に読み替えないよう setUTCFullYear で組む) */
export function wallToUtcMs(w: WallClock): number {
  const d = new Date(0);
  d.setUTCFullYear(w.year, w.month - 1, w.day);
  d.setUTCHours(w.hour, w.minute, w.second, 0);
  return d.getTime();
}

/** その瞬間の Asia/Tokyo の暦の日時 */
export function businessWallClock(instantMs: number): WallClock {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(new Date(instantMs))) parts[p.type] = p.value;
  const year = Number(parts.year);
  return {
    year: parts.era === 'BC' ? 1 - year : year,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** その瞬間の Asia/Tokyo の時差 (ミリ秒。秒の単位まで) */
export function businessOffsetMs(instantMs: number): number {
  const instant = Math.floor(instantMs / MS_PER_SECOND) * MS_PER_SECOND;
  return wallToUtcMs(businessWallClock(instant)) - instant;
}

/**
 * Asia/Tokyo の暦の日時を瞬間にする。
 * 夏時間の終わりで 2 回ある時刻は早い方 (夏時間の側) にし、
 * 夏時間の始まりで飛ばされて無い時刻は、飛ぶ前の時差で読む (0:00 は 1:00 夏時間と同じ瞬間になる)。
 */
export function businessWallToInstantMs(w: WallClock): number {
  const local = wallToUtcMs(w);
  const before = businessOffsetMs(local - MS_PER_DAY);
  const after = businessOffsetMs(local + MS_PER_DAY);
  const candidates = [local - before, local - after].filter(
    (instant) => instant + businessOffsetMs(instant) === local,
  );
  if (candidates.length === 0) return local - before;
  return Math.min(...candidates);
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad4 = (n: number) => String(n).padStart(4, '0');

/** 暦の日付 (YYYY-MM-DD) */
export function formatDate(w: Pick<WallClock, 'year' | 'month' | 'day'>): string {
  return `${pad4(w.year)}-${pad2(w.month)}-${pad2(w.day)}`;
}

/**
 * 瞬間を RFC 3339 の日時にする。時差はその瞬間の Asia/Tokyo の時差で書く。
 * 時差が分の単位で書けない (1888 年より前の地方時 +09:18:59) ときは、同じ瞬間を UTC (Z) で書く。
 */
export function formatBusinessDateTime(instantMs: number): string {
  const offset = businessOffsetMs(instantMs);
  if (offset % MS_PER_MINUTE !== 0) {
    return new Date(instantMs).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }
  const w = businessWallClock(instantMs);
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset) / MS_PER_MINUTE;
  const zone = `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
  return `${formatDate(w)}T${pad2(w.hour)}:${pad2(w.minute)}:${pad2(w.second)}${zone}`;
}
