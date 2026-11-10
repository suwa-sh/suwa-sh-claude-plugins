/**
 * reserve-room.steps.ts — UC「会議室を予約する」の step (d2-implement mode=integrate)
 *
 * 次の step は view-room-availability.steps.ts の定義を使い、ここでは再定義しない:
 * - 会議室が N 部屋登録されている
 * - 現在が <日付> <時刻> である
 * - 会議室Xの <日付> <開始>-<終了> に(社員Yの)予約がある
 *   (予約の今の状態・「予約した」イベント・30 分枠の占有の 3 つの表をそろえて入れる。重なりは占有の主キーで判定される)
 * - 会議室Xの <日付> <開始>-<終了> の予約が取り消されている
 *
 * - 予約は画面の入口と同じ順に、会議室の選択肢を読む入口関数 loadRooms で会議室を選び、
 *   予約の入口関数 submitReservation で送る。どちらも tracedFn (layer screen) で包み、
 *   this.api.asFetch({ tier: 'frontend', layer: 'api-client' }) を渡す (「画面 → API クライアント → backend」を 1 本のトレースに載せる)
 * - 結果は入口関数が返す画面の状態と、this.db の reservations / reservation_events / room_slot_occupancies で確かめる
 * - 送り直し (SPEC-002-03) も同じ入口関数で送る。画面は 200 と 201 を区別しないので、
 *   「新しい予約は作られない」は 3 つの表の行数が変わらないこと、「成立済みのその予約」は送る前からあった予約の ID と一致することで確かめる
 * - 未入力の項目 (SPEC-002-01-8・01-9) は、選んだ項目だけを画面の入力値に入れて同じ入口関数で送り、
 *   API が呼ばれないこと (呼び出し回数 0) と、入口関数が返す未入力の項目 (fields) で確かめる
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Given, Then, When } from '@cucumber/cucumber';
import { tracedFn } from '@repo/test-support/tracer';
import type { TokenProvider } from '../../apps/frontend/src/api/tokenProvider';
import { loadRooms } from '../../apps/frontend/src/screens/ReserveRoom/loadRooms';
import {
  type ReserveRoomState,
  submitReservation,
} from '../../apps/frontend/src/screens/ReserveRoom/submitReservation';
import {
  RESERVATION_EVENTS_COLUMNS as E,
  ROOMS_COLUMNS as M,
  ROOM_SLOT_OCCUPANCIES_COLUMNS as O,
  RESERVATIONS_COLUMNS as R,
  RESERVATION_EVENTS_TABLE,
  RESERVATIONS_TABLE,
  ROOM_SLOT_OCCUPANCIES_TABLE,
  ROOMS_TABLE,
} from '../../packages/contracts/db/tables';
import type { D2World } from '../support/world';

const FRONTEND_TIER = 'frontend';
/** 業務のタイムゾーン Asia/Tokyo の時差 (ADR 0017) */
const BUSINESS_OFFSET = '+09:00';
const SLOT_MINUTES = 30;
/** 予約の前提を入れた時刻 (イベントの発生時刻。結果に影響しない) */
const SEEDED_AT = '2026-11-05T09:00:00+09:00';

const loadRoomsScreen = tracedFn('予約画面', 'loadRooms', loadRooms, {
  tier: FRONTEND_TIER,
  layer: 'screen',
});
const submitReservationScreen = tracedFn('予約画面', 'submitReservation', submitReservation, {
  tier: FRONTEND_TIER,
  layer: 'screen',
});

interface RecordCounts {
  reservations: number;
  events: number;
  occupancies: number;
}

/** シナリオごとの観測結果 (World はシナリオごとに作り直される) */
interface ScenarioState {
  /** 予約を送った結果 (同時の予約では 2 件) */
  results: ReserveRoomState[];
  /** 予約を送る直前の 3 つの表の行数 (「予約は記録されない」の比較に使う) */
  before?: RecordCounts;
  /** 予約を送る直前の予約の今の状態 (送り直しで「成立済みのその予約」か「新しい予約」かの比較に使う) */
  beforeReservations?: StoredReservation[];
  /** 画面で選んでいる入力値 (未入力の項目のシナリオ。選んでいない項目は空のまま) */
  draft?: { employee: string; value: ReservationInput };
  /** 予約の入口関数が API を呼んだ回数 (未入力の項目のシナリオで「予約は送られない」を確かめる) */
  submitFetchCalls?: number;
}

/** 予約の入口関数に渡す画面の入力値 (会議室・日付・開始時刻・終了時刻。未入力は空文字) */
type ReservationInput = Parameters<typeof submitReservation>[0];

interface StoredReservation {
  reservation_id: string;
  room_id: string;
  start_at: string;
  end_at: string;
  reserved_by: string;
  status: string;
}
const states = new WeakMap<D2World, ScenarioState>();
function stateOf(world: D2World): ScenarioState {
  let s = states.get(world);
  if (!s) {
    s = { results: [] };
    states.set(world, s);
  }
  return s;
}

/** 「A」から社員の呼び名 (test-employee-<x> / employee-<x> の x) を取る */
function employeeKey(who: string): string {
  return who.replace(/^社員/, '').toLowerCase();
}

/** テスト用のトークンの供給元。契約の bearerAuth の説明どおり test-employee-<x> を返す */
function testTokens(employee: string): TokenProvider {
  return {
    getAccessToken: async () => `test-employee-${employee}`,
    signIn: async () => {},
  };
}

/** 業務の日付と時刻 (HH:mm) を日時にする。nextDay なら翌日の時刻 */
function businessDateTime(date: string, time: string, nextDay = false): Date {
  const [h, m] = time.split(':').map(Number);
  const base = new Date(`${date}T00:00:00${BUSINESS_OFFSET}`);
  return new Date(base.getTime() + ((nextDay ? 24 : 0) * 60 + h * 60 + m) * 60_000);
}

/** 終了の時刻を画面の入力値にする。翌日の時刻は 24 時以降の時刻 (翌日 0:00 → 24:00) で入れる (ADR 0017) */
function endTimeInput(time: string, nextDay: boolean): string {
  if (!nextDay) return time;
  const [h, m] = time.split(':').map(Number);
  return `${h + 24}:${String(m).padStart(2, '0')}`;
}

async function countRecords(world: D2World): Promise<RecordCounts> {
  const count = async (table: string) =>
    (await world.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
  return {
    reservations: await count(RESERVATIONS_TABLE),
    events: await count(RESERVATION_EVENTS_TABLE),
    occupancies: await count(ROOM_SLOT_OCCUPANCIES_TABLE),
  };
}

async function allReservations(world: D2World): Promise<StoredReservation[]> {
  const res = await world.db.query<StoredReservation>(
    `SELECT ${R.reservation_id}, ${R.room_id}, ${R.start_at}, ${R.end_at}, ${R.reserved_by}, ${R.status}
       FROM ${RESERVATIONS_TABLE}`,
  );
  return res.rows;
}

async function roomIdOf(world: D2World, roomName: string): Promise<string> {
  const res = await world.db.query<{ room_id: string }>(
    `SELECT ${M.room_id} FROM ${ROOMS_TABLE} WHERE ${M.room_name} = $1`,
    [roomName],
  );
  assert.equal(res.rows.length, 1, `${roomName} が登録されていない`);
  return res.rows[0].room_id;
}

/**
 * 社員の予約を 1 件入れる (予約の API を通さない。ADR 0007)。view-room-availability.steps.ts の前提と同じ入れ方で、
 * 予約の今の状態・イベント・30 分枠の占有を食い違わせずに入れる。取り消した予約は取り消しのイベントを足し、占有を入れない
 */
async function seedOwnReservation(
  world: D2World,
  input: { roomName: string; startAt: Date; endAt: Date; employee: string; cancelled: boolean },
): Promise<void> {
  const roomId = await roomIdOf(world, input.roomName);
  const reservationId = randomUUID();
  const employeeId = `employee-${input.employee}`;
  await world.db.query(
    `INSERT INTO ${RESERVATIONS_TABLE} (${R.reservation_id}, ${R.room_id}, ${R.start_at}, ${R.end_at}, ${R.reserved_by}, ${R.status})
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      reservationId,
      roomId,
      input.startAt.toISOString(),
      input.endAt.toISOString(),
      employeeId,
      input.cancelled ? 'cancelled' : 'reserved',
    ],
  );
  const events = input.cancelled ? ['reserved', 'cancelled'] : ['reserved'];
  for (const eventType of events) {
    await world.db.query(
      `INSERT INTO ${RESERVATION_EVENTS_TABLE}
         (${E.event_id}, ${E.reservation_id}, ${E.event_type}, ${E.occurred_at}, ${E.actor_employee_id}, ${E.recorded_at})
       VALUES ($1, $2, $3, $4, $5, $4)`,
      [randomUUID(), reservationId, eventType, SEEDED_AT, employeeId],
    );
  }
  if (input.cancelled) return;
  for (let t = input.startAt.getTime(); t < input.endAt.getTime(); t += SLOT_MINUTES * 60_000) {
    await world.db.query(
      `INSERT INTO ${ROOM_SLOT_OCCUPANCIES_TABLE} (${O.room_id}, ${O.slot_start_at}, ${O.reservation_id})
       VALUES ($1, $2, $3)`,
      [roomId, new Date(t).toISOString(), reservationId],
    );
  }
}

/** 社員の有効な予約の件数 */
function activeCountOf(rows: StoredReservation[], employee: string): number {
  return rows.filter((r) => r.reserved_by === `employee-${employee}` && r.status === 'reserved')
    .length;
}

/** 画面で会議室の選択肢を読み、名前の合う会議室の ID を取る (社員が画面で会議室を選ぶのと同じ) */
async function chooseRoom(world: D2World, employee: string, roomName: string): Promise<string> {
  const options = await loadRoomsScreen({
    tokens: testTokens(employee),
    fetch: world.api.asFetch({ tier: FRONTEND_TIER, layer: 'api-client' }),
  });
  assert.equal(options.kind, 'loaded', `会議室の選択肢を読めなかった: ${JSON.stringify(options)}`);
  const room =
    options.kind === 'loaded' ? options.rooms.find((r) => r.name === roomName) : undefined;
  assert.ok(room, `${roomName} が選択肢に無い`);
  return room.roomId;
}

function submit(
  world: D2World,
  employee: string,
  value: { roomId: string; date: string; startTime: string; endTime: string },
): Promise<ReserveRoomState> {
  return submitReservationScreen(value, {
    tokens: testTokens(employee),
    fetch: world.api.asFetch({ tier: FRONTEND_TIER, layer: 'api-client' }),
  });
}

async function reserve(
  world: D2World,
  who: string,
  roomName: string,
  slot: { date: string; startTime: string; endTime: string },
): Promise<void> {
  const employee = employeeKey(who);
  const roomId = await chooseRoom(world, employee, roomName);
  const state = stateOf(world);
  state.before = await countRecords(world);
  state.beforeReservations = await allReservations(world);
  state.results.push(await submit(world, employee, { roomId, ...slot }));
}

function onlyResult(world: D2World): ReserveRoomState {
  const { results } = stateOf(world);
  assert.equal(results.length, 1, '予約を 1 回だけ送っていない');
  return results[0];
}

function completed(world: D2World) {
  const result = onlyResult(world);
  assert.equal(result.kind, 'completed', `予約が成立しなかった: ${JSON.stringify(result)}`);
  return result.kind === 'completed' ? result.reservation : assert.fail('予約が成立しなかった');
}

async function storedReservation(world: D2World, reservationId: string) {
  const res = await world.db.query<{ reserved_by: string; status: string }>(
    `SELECT ${R.reserved_by}, ${R.status} FROM ${RESERVATIONS_TABLE} WHERE ${R.reservation_id} = $1`,
    [reservationId],
  );
  assert.equal(res.rows.length, 1, '成立した予約が記録されていない');
  return res.rows[0];
}

function assertRejected(world: D2World, code: string): void {
  assert.deepEqual(onlyResult(world), { kind: 'error', code });
}

// ---- 前提 ----

Given(
  /^会議室(\S+?)の (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(翌日)?(\d{1,2}:\d{2}) に予約が無い$/,
  async function (
    this: D2World,
    room: string,
    date: string,
    start: string,
    nextDay: string | null | undefined,
    end: string,
  ) {
    // 予約は前提で入れない限り無い。指定の時間帯に有効な予約・占有が無いことを確かめる
    const startAt = businessDateTime(date, start).toISOString();
    const endAt = businessDateTime(date, end, Boolean(nextDay)).toISOString();
    const res = await this.db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM ${ROOM_SLOT_OCCUPANCIES_TABLE} o
         JOIN ${ROOMS_TABLE} m ON m.${M.room_id} = o.${O.room_id}
       WHERE m.${M.room_name} = $1 AND o.${O.slot_start_at} >= $2 AND o.${O.slot_start_at} < $3`,
      [`会議室${room}`, startAt, endAt],
    );
    assert.equal(res.rows[0].n, 0, '指定の時間帯に予約がある');
  },
);

// ---- 操作 ----

When(
  /^社員(\S+?)が会議室(\S+?)を (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) で予約する$/,
  async function (
    this: D2World,
    employee: string,
    room: string,
    date: string,
    start: string,
    end: string,
  ) {
    await reserve(this, employee, `会議室${room}`, { date, startTime: start, endTime: end });
  },
);

When(
  /^社員(\S+?)が会議室(\S+?)を (\d{4}-\d{2}-\d{2}) の開始時刻 (\d{1,2}:\d{2})・終了時刻 (翌日 )?(\d{1,2}:\d{2})(?: \(24:00\))? で予約する$/,
  async function (
    this: D2World,
    employee: string,
    room: string,
    date: string,
    start: string,
    nextDay: string | null | undefined,
    end: string,
  ) {
    await reserve(this, employee, `会議室${room}`, {
      date,
      startTime: start,
      endTime: endTimeInput(end, Boolean(nextDay)),
    });
  },
);

When(
  /^社員(\S+?)と社員(\S+?)が同時に会議室(\S+?)を (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) で予約する$/,
  async function (
    this: D2World,
    first: string,
    second: string,
    room: string,
    date: string,
    start: string,
    end: string,
  ) {
    const employees = [employeeKey(first), employeeKey(second)];
    const roomId = await chooseRoom(this, employees[0], `会議室${room}`);
    const state = stateOf(this);
    state.before = await countRecords(this);
    // 2 人の予約を待ち合わせずに同時に送る
    state.results = await Promise.all(
      employees.map((e) => submit(this, e, { roomId, date, startTime: start, endTime: end })),
    );
  },
);

// ---- 結果 ----

Then('予約が成立する', async function (this: D2World) {
  const reservation = completed(this);
  await storedReservation(this, reservation.reservationId);
  // 予約の今の状態・「予約した」イベント・30 分枠の占有がそろって 1 件分増える
  const before = stateOf(this).before;
  assert.ok(before);
  const after = await countRecords(this);
  assert.equal(after.reservations, before.reservations + 1);
  assert.equal(after.events, before.events + 1);
  assert.ok(after.occupancies > before.occupancies, '30 分枠の占有が記録されていない');
});

Then(/^予約者として社員(\S+?)が記録される$/, async function (this: D2World, employee: string) {
  const reservation = completed(this);
  const employeeId = `employee-${employeeKey(employee)}`;
  assert.equal((await storedReservation(this, reservation.reservationId)).reserved_by, employeeId);
  const events = await this.db.query<{ actor_employee_id: string; event_type: string }>(
    `SELECT ${E.actor_employee_id}, ${E.event_type} FROM ${RESERVATION_EVENTS_TABLE} WHERE ${E.reservation_id} = $1`,
    [reservation.reservationId],
  );
  assert.deepEqual(events.rows, [{ actor_employee_id: employeeId, event_type: 'reserved' }]);
});

Then('その予約は予約済みになる', async function (this: D2World) {
  const reservation = completed(this);
  assert.equal(reservation.status, 'reserved');
  assert.equal((await storedReservation(this, reservation.reservationId)).status, 'reserved');
});

Then('予約は記録されない', async function (this: D2World) {
  const before = stateOf(this).before;
  assert.ok(before, '予約を送っていない');
  assert.deepEqual(await countRecords(this), before);
});

Then('予約は成立せず、時間帯が正しくないことが示される', async function (this: D2World) {
  assertRejected(this, 'INVALID_TIME_RANGE');
});

Then('予約は成立せず、時刻は 30 分刻みで指定することが示される', async function (this: D2World) {
  assertRejected(this, 'NOT_ON_30_MINUTES');
});

Then('予約は成立せず、過去の時間帯は予約できないことが示される', async function (this: D2World) {
  assertRejected(this, 'PAST_TIME_SLOT');
});

Then('予約は成立せず、時間帯が既存の予約と重なることが示される', async function (this: D2World) {
  assertRejected(this, 'SLOT_OVERLAPS');
});

Then(
  '成立する予約は 1 件だけで、もう一方には時間帯が重なることが示される',
  async function (this: D2World) {
    const { results, before } = stateOf(this);
    assert.equal(results.length, 2, '2 人分の予約を送っていない');
    const done = results.filter((r) => r.kind === 'completed');
    const rejected = results.filter((r) => r.kind !== 'completed');
    assert.equal(done.length, 1, `成立した予約が 1 件でない: ${JSON.stringify(results)}`);
    assert.deepEqual(rejected, [{ kind: 'error', code: 'SLOT_OVERLAPS' }]);
    assert.ok(before);
    const after = await countRecords(this);
    assert.equal(after.reservations, before.reservations + 1);
    assert.equal(after.events, before.events + 1);
  },
);

// ---- 自分の有効な予約と同じ内容の送り直し (SPEC-002-03) ----

Given(
  /^社員(\S+?)の会議室(\S+?)の (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) の予約が成立しているが応答が届かなかった$/,
  async function (
    this: D2World,
    employee: string,
    room: string,
    date: string,
    start: string,
    end: string,
  ) {
    // 応答が届かなかったことは保存の状態に現れない (成立した予約は記録済み)。成立済みの予約として入れる
    await seedOwnReservation(this, {
      roomName: `会議室${room}`,
      startAt: businessDateTime(date, start),
      endAt: businessDateTime(date, end),
      employee: employeeKey(employee),
      cancelled: false,
    });
  },
);

Given(
  /^社員(\S+?)の会議室(\S+?)の (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) の予約が取り消されている$/,
  async function (
    this: D2World,
    employee: string,
    room: string,
    date: string,
    start: string,
    end: string,
  ) {
    await seedOwnReservation(this, {
      roomName: `会議室${room}`,
      startAt: businessDateTime(date, start),
      endAt: businessDateTime(date, end),
      employee: employeeKey(employee),
      cancelled: true,
    });
  },
);

When(
  /^社員(\S+?)が会議室(\S+?)を (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) でもう一度予約する$/,
  async function (
    this: D2World,
    employee: string,
    room: string,
    date: string,
    start: string,
    end: string,
  ) {
    // 送り直しは画面から同じ内容をもう一度送る操作 (通常の予約と同じ入口関数を通る)
    await reserve(this, employee, `会議室${room}`, { date, startTime: start, endTime: end });
  },
);

Then('新しい予約は作られず、予約が成立していることが示される', async function (this: D2World) {
  // 画面は予約の成立として示す (200 の送り直しも 201 と区別しない)
  completed(this);
  // 予約の今の状態・イベント・30 分枠の占有のどれも増えない
  const before = stateOf(this).before;
  assert.ok(before, '予約を送っていない');
  assert.deepEqual(await countRecords(this), before);
});

Then('示される予約は成立済みのその予約である', async function (this: D2World) {
  const shown = completed(this);
  const existing = stateOf(this).beforeReservations?.find(
    (r) => r.reservation_id === shown.reservationId,
  );
  assert.ok(existing, `示された予約 ${shown.reservationId} は送る前から成立していた予約でない`);
  assert.equal(existing.status, 'reserved');
  assert.equal(shown.status, 'reserved');
  // 示された時間帯・会議室が成立済みの予約と同じ
  assert.equal(
    new Date(existing.start_at).getTime(),
    businessDateTime(shown.date, shown.startTime).getTime(),
  );
  const rooms = await this.db.query<{ room_name: string }>(
    `SELECT ${M.room_name} FROM ${ROOMS_TABLE} WHERE ${M.room_id} = $1`,
    [existing.room_id],
  );
  assert.equal(shown.roomName, rooms.rows[0]?.room_name);
});

Then(
  /^社員(\S+?)の有効な予約は (\d+) 件のまま変わらない$/,
  async function (this: D2World, employee: string, count: string) {
    const key = employeeKey(employee);
    const before = stateOf(this).beforeReservations;
    assert.ok(before, '予約を送っていない');
    assert.equal(activeCountOf(before, key), Number(count), '送る前の有効な予約の件数が文と違う');
    assert.equal(activeCountOf(await allReservations(this), key), Number(count));
  },
);

Then('新しい予約が成立する', async function (this: D2World) {
  const reservation = completed(this);
  const state = stateOf(this);
  assert.ok(
    !state.beforeReservations?.some((r) => r.reservation_id === reservation.reservationId),
    '送る前からあった予約が示された (新しい予約が作られていない)',
  );
  const stored = await storedReservation(this, reservation.reservationId);
  assert.equal(stored.status, 'reserved');
  assert.ok(state.before);
  const after = await countRecords(this);
  assert.equal(after.reservations, state.before.reservations + 1);
  assert.equal(after.events, state.before.events + 1);
  assert.ok(after.occupancies > state.before.occupancies, '30 分枠の占有が記録されていない');
});

Then('過去の時間帯として断られない', async function (this: D2World) {
  const result = onlyResult(this);
  assert.notDeepEqual(result, { kind: 'error', code: 'PAST_TIME_SLOT' });
});

// ---- 未入力の項目 (SPEC-002-01-8・01-9) ----
// 選んだ項目を画面の入力値として持ち、選んでいない項目は空のまま予約の入口関数に渡す。
// 入口関数が API を呼ばないこと (送らずに止める) と、未入力の項目ごとに選ぶよう示すことを確かめる

/** 画面の入力値を作る (前提で選んだ項目を重ねる)。社員は最初に選んだ社員のまま */
function choose(world: D2World, who: string, picked: Partial<ReservationInput>): void {
  const state = stateOf(world);
  const employee = employeeKey(who);
  const value = state.draft?.value ?? { roomId: '', date: '', startTime: '', endTime: '' };
  state.draft = { employee: state.draft?.employee ?? employee, value: { ...value, ...picked } };
}

/** 選んでいる入力値のまま予約する。API 呼び出しの回数を数え、3 つの表の行数を送る前に控える */
async function submitDraft(world: D2World, who: string): Promise<void> {
  const state = stateOf(world);
  const employee = employeeKey(who);
  assert.ok(state.draft, '画面で何も選んでいない');
  assert.equal(state.draft.employee, employee, '選んだ社員と予約する社員が違う');
  state.before = await countRecords(world);
  state.beforeReservations = await allReservations(world);
  state.submitFetchCalls = 0;
  const tracedFetch = world.api.asFetch({ tier: FRONTEND_TIER, layer: 'api-client' });
  const countingFetch: typeof tracedFetch = (...args) => {
    state.submitFetchCalls = (state.submitFetchCalls ?? 0) + 1;
    return tracedFetch(...args);
  };
  state.results.push(
    await submitReservationScreen(state.draft.value, {
      tokens: testTokens(employee),
      fetch: countingFetch,
    }),
  );
}

/** 予約が API に送られず、未入力の項目として fields が示されたことを確かめる */
function assertMissing(world: D2World, fields: string[]): void {
  assert.equal(stateOf(world).submitFetchCalls, 0, '未入力なのに予約が API に送られた');
  assert.deepEqual(onlyResult(world), { kind: 'missing', fields });
}

Given(
  /^社員(\S+?)が (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) を選んでいる$/,
  async function (this: D2World, employee: string, date: string, start: string, end: string) {
    choose(this, employee, { date, startTime: start, endTime: end });
  },
);

Given(
  /^社員(\S+?)が会議室(\S+?)を選んでいる$/,
  async function (this: D2World, employee: string, room: string) {
    const roomId = await chooseRoom(this, employeeKey(employee), `会議室${room}`);
    choose(this, employee, { roomId });
  },
);

Given(
  /^社員(\S+?)が会議室(\S+?)と (\d{4}-\d{2}-\d{2}) の開始時刻 (\d{1,2}:\d{2}) を選んでいる$/,
  async function (this: D2World, employee: string, room: string, date: string, start: string) {
    const roomId = await chooseRoom(this, employeeKey(employee), `会議室${room}`);
    choose(this, employee, { roomId, date, startTime: start });
  },
);

When(/^社員(\S+?)が会議室を選ばずに予約する$/, async function (this: D2World, employee: string) {
  assert.equal(stateOf(this).draft?.value.roomId, '', '会議室を選んでいる');
  await submitDraft(this, employee);
});

When(
  /^社員(\S+?)が日付・開始時刻・終了時刻を選ばずに予約する$/,
  async function (this: D2World, employee: string) {
    const value = stateOf(this).draft?.value;
    assert.deepEqual(
      [value?.date, value?.startTime, value?.endTime],
      ['', '', ''],
      '日付・開始時刻・終了時刻のどれかを選んでいる',
    );
    await submitDraft(this, employee);
  },
);

When(/^社員(\S+?)が終了時刻を選ばずに予約する$/, async function (this: D2World, employee: string) {
  assert.equal(stateOf(this).draft?.value.endTime, '', '終了時刻を選んでいる');
  await submitDraft(this, employee);
});

Then('予約は送られず成立せず、会議室を選ぶことが示される', function (this: D2World) {
  assertMissing(this, ['roomId']);
});

Then(
  '予約は送られず成立せず、日付・開始時刻・終了時刻をそれぞれ選ぶことが示される',
  function (this: D2World) {
    assertMissing(this, ['date', 'startTime', 'endTime']);
  },
);

Then('予約は送られず成立せず、終了時刻を選ぶことが示される', function (this: D2World) {
  assertMissing(this, ['endTime']);
});

Then('会議室・日付・開始時刻を選ぶことは示されない', function (this: D2World) {
  const result = onlyResult(this);
  assert.equal(result.kind, 'missing', `未入力として止まっていない: ${JSON.stringify(result)}`);
  const fields: string[] = result.kind === 'missing' ? result.fields : [];
  for (const f of ['roomId', 'date', 'startTime']) {
    assert.ok(!fields.includes(f), `${f} を選ぶことが示された`);
  }
});
