import {
  type BusinessError,
  businessError,
  type TimeRangeErrorCode,
  type TimeRangeErrorReason,
} from './businessError';
import { err, ok, type Result } from './result';

const HOUR_MS = 60 * 60 * 1000;
/** 時刻の刻み (ADR 0009・0017: 開始と終了は 30 分刻み)。分で持つ */
const SLOT_MINUTES = 30;
const SLOT_MS = SLOT_MINUTES * 60 * 1000;
/** 1 日の長さの上限より長い幅 (夏時間の終わりの日は 25 時間)。日付の境目を探す範囲に使う */
const SEARCH_SPAN_MS = 26 * HOUR_MS;
/**
 * 業務のタイムゾーン (ADR 0003)。Asia/Tokyo には過去に夏時間 (1948〜1951 年。+10:00) があるので、
 * 固定のずれを使わず、実行環境に組み込みのタイムゾーンの表 (Intl) で日本時間の日付と時刻を求める。
 * 実行環境の TZ に依存させない (getHours や getDate を使わない)。Intl は言語の組み込みで外部ライブラリではない (ADR 0013)
 */
const BUSINESS_TIME_ZONE = 'Asia/Tokyo';
const businessClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  hourCycle: 'h23',
});

/**
 * 1 ミリ秒未満まで持つ時点。Date は 1 ミリ秒未満を切り捨てるので、切り捨てた epoch ms と、
 * ミリ秒の後に続く小数の数字 (例 10:00:00.0001 なら epochMs は 10:00:00.000、subMillisecondDigits は '1') を分けて持つ。
 * 表す時点は epochMs に 0.<subMillisecondDigits> ミリ秒を足したもの
 */
export interface PreciseInstant {
  readonly epochMs: number;
  readonly subMillisecondDigits: string;
}

/** 時間帯の生成が受ける時点 (Date は 1 ミリ秒未満が 0 の時点として扱う) */
export type InstantInput = Date | PreciseInstant;

/**
 * 時間帯 (値オブジェクト)。開始を含み終了を含まない区間 (半開区間)。
 * 生成のときに ADR 0017 の順で検証し、満たさない時間帯のインスタンスを作れない:
 * (1) 開始が終了より前 (INVALID_TIME_RANGE)、(2) 開始と終了が 30 分刻み (NOT_ON_30_MINUTES)、
 * (3) 業務の日付 (開始の Asia/Tokyo の日付) の 0:00 から翌日 0:00 までに収まる (INVALID_TIME_RANGE)。
 * 過去かどうかは検査しない (PAST_TIME_SLOT は予約の集約の作成だけが持つ)。
 * 日時は epoch ms で内部に持ち、外へは毎回コピーの Date を返す (Date は可変なので、検証済みの値を外から変えさせない)。
 */
export class TimeRange {
  readonly #startMs: number;
  readonly #endMs: number;

  private constructor(startMs: number, endMs: number) {
    this.#startMs = startMs;
    this.#endMs = endMs;
    Object.freeze(this);
  }

  /** 開始の日時 (コピー。変更しても時間帯に影響しない) */
  get startAt(): Date {
    return new Date(this.#startMs);
  }

  /** 終了の日時 (コピー。変更しても時間帯に影響しない) */
  get endAt(): Date {
    return new Date(this.#endMs);
  }

  static create(
    startAt: InstantInput,
    endAt: InstantInput,
  ): Result<TimeRange, BusinessError<TimeRangeErrorCode, TimeRangeErrorReason>> {
    const startInstant = toPreciseInstant(startAt);
    const endInstant = toPreciseInstant(endAt);
    // (1) の順の比較は 1 ミリ秒未満まで含めた全精度で行う (同じミリ秒の中の開始と終了を等しいとみなさない)
    if (!(compareInstants(startInstant, endInstant) < 0)) {
      return err(businessError('INVALID_TIME_RANGE', 'START_NOT_BEFORE_END'));
    }
    if (!isOnSlotBoundaryInstant(startInstant) || !isOnSlotBoundaryInstant(endInstant)) {
      return err(businessError('NOT_ON_30_MINUTES'));
    }
    // ここから先は 1 ミリ秒未満が 0 の時点だけが残るので、epoch ms で扱う
    const start = startInstant.epochMs;
    const end = endInstant.epochMs;
    if (end > nextBusinessDayStartOf(businessDayStartOf(start))) {
      return err(businessError('INVALID_TIME_RANGE', 'OUTSIDE_BUSINESS_DAY'));
    }
    return ok(new TimeRange(start, end));
  }

  /** 半開区間で一部でも重なるか。重なりの判定はここだけに置く (ADR 0009) */
  overlaps(other: { startAt: Date; endAt: Date }): boolean {
    return this.#startMs < other.endAt.getTime() && other.startAt.getTime() < this.#endMs;
  }

  /**
   * この時間帯が占める 30 分枠の開始時刻 (古い順)。「会議室の 30 分枠の占有」の行の元 (ADR 0003)。
   * 開始と終了は 30 分刻みに検証済みで、日本時間の時差は時間単位なので、epoch ms で 30 分ずつ進めれば枠の境目に乗る
   */
  slotStartTimes(): Date[] {
    const slots: Date[] = [];
    for (let t = this.#startMs; t < this.#endMs; t += SLOT_MS) slots.push(new Date(t));
    return slots;
  }

  /**
   * この時間帯が属する業務の日付の 0:00 から翌日 0:00 まで。
   * 夏時間の始まり・終わりの日は 23 時間・25 時間になる (24 時間と決めつけない)
   */
  businessDay(): { startAt: Date; endAt: Date } {
    const dayStart = businessDayStartOf(this.#startMs);
    return { startAt: new Date(dayStart), endAt: new Date(nextBusinessDayStartOf(dayStart)) };
  }
}

interface BusinessWallClock {
  dateKey: number;
  minute: number;
  second: number;
}

/** epoch ms の日本時間の日付 (yyyymmdd の数) と分・秒 */
function businessWallClockOf(epochMs: number): BusinessWallClock {
  const parts = Object.fromEntries(
    businessClock.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]),
  );
  return {
    dateKey: Number(parts.year) * 10000 + Number(parts.month) * 100 + Number(parts.day),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function toPreciseInstant(value: InstantInput): PreciseInstant {
  return value instanceof Date ? { epochMs: value.getTime(), subMillisecondDigits: '' } : value;
}

/** 1 ミリ秒未満の数字に 0 でないものがあるか */
function hasSubMillisecond(instant: PreciseInstant): boolean {
  return /[1-9]/.test(instant.subMillisecondDigits);
}

/** 2 つの時点の大小 (負: a が前、0: 同じ、正: a が後)。ミリ秒で比べ、同じなら 1 ミリ秒未満の数字を桁をそろえて比べる */
function compareInstants(a: PreciseInstant, b: PreciseInstant): number {
  if (a.epochMs !== b.epochMs) return a.epochMs < b.epochMs ? -1 : 1;
  const width = Math.max(a.subMillisecondDigits.length, b.subMillisecondDigits.length);
  const aDigits = a.subMillisecondDigits.padEnd(width, '0');
  const bDigits = b.subMillisecondDigits.padEnd(width, '0');
  if (aDigits === bDigits) return 0;
  return aDigits < bDigits ? -1 : 1;
}

/** 1 ミリ秒未満が 0 で、日本時間の時刻が 30 分刻みか */
function isOnSlotBoundaryInstant(instant: PreciseInstant): boolean {
  return !hasSubMillisecond(instant) && isOnSlotBoundary(instant.epochMs);
}

/** 日本時間の時刻の分が 0 か 30 ちょうど (秒・ミリ秒が 0) か */
function isOnSlotBoundary(epochMs: number): boolean {
  if (((epochMs % 1000) + 1000) % 1000 !== 0) return false;
  const { minute, second } = businessWallClockOf(epochMs);
  return second === 0 && minute % SLOT_MINUTES === 0;
}

/**
 * 開始の日時の Asia/Tokyo での日付の 0:00 (epoch ms)。日本時間の日付がその日になる最も早い時点とする
 * (夏時間の始まりの日は 0:00 が無く 1:00 から、終わりの日は 0:00 台が 2 回あり 1 回目から)。
 * 日本時間の日付は時点に対して減らないので、二分探索で境目を求める
 */
function businessDayStartOf(epochMs: number): number {
  const dateKey = businessWallClockOf(epochMs).dateKey;
  return firstInstantWhere(
    epochMs - SEARCH_SPAN_MS,
    epochMs,
    (t) => businessWallClockOf(t).dateKey >= dateKey,
  );
}

/** 業務の日付の 0:00 (businessDayStartOf の値) から、翌日の 0:00 (epoch ms) */
function nextBusinessDayStartOf(dayStartMs: number): number {
  const dateKey = businessWallClockOf(dayStartMs).dateKey;
  return firstInstantWhere(
    dayStartMs,
    dayStartMs + SEARCH_SPAN_MS,
    (t) => businessWallClockOf(t).dateKey > dateKey,
  );
}

/** lo では偽・hi では真になる単調な条件が、最初に真になる時点 (ms) */
function firstInstantWhere(lo: number, hi: number, holds: (epochMs: number) => boolean): number {
  let below = lo;
  let at = hi;
  while (at - below > 1) {
    const mid = Math.floor((below + at) / 2);
    if (holds(mid)) at = mid;
    else below = mid;
  }
  return at;
}
