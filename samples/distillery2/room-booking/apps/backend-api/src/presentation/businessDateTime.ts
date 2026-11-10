// 応答の日時を、業務のタイムゾーン (Asia/Tokyo) の時差付きの RFC 3339 (例 2026-11-10T10:00:00+09:00) で書く。
// 契約の例と同じ表記にする。時差は固定の +09:00 と決めつけず、実行環境に組み込みのタイムゾーンの表 (Intl) から求める
// (Asia/Tokyo には過去に夏時間があった)。実行環境の TZ には依存しない。

const BUSINESS_TIME_ZONE = 'Asia/Tokyo';
const MINUTE_MS = 60 * 1000;

const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** 日時を Asia/Tokyo の時差付きの RFC 3339 にする (秒まで。ミリ秒が 0 でなければミリ秒も書く) */
export function formatBusinessDateTime(value: Date): string {
  const parts = Object.fromEntries(wallClock.formatToParts(value).map((p) => [p.type, p.value]));
  const ms = value.getUTCMilliseconds();
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
    ms,
  );
  const offsetMinutes = Math.round((wallAsUtc - value.getTime()) / MINUTE_MS);
  const sign = offsetMinutes < 0 ? '-' : '+';
  const abs = Math.abs(offsetMinutes);
  const fraction = ms === 0 ? '' : `.${pad(ms, 3)}`;
  return (
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${fraction}` +
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}
