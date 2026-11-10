/**
 * view-room-availability.steps.ts — UC「会議室の空き状況を照会する」の step (d2-implement mode=integrate)
 *
 * - 前提のデータは this.db (pglite) に SQL で入れる (予約の API を通さない。ADR 0007)。
 *   予約は今の状態・イベント・30 分枠の占有の 3 つの表を食い違わせずに入れる (ADR 0003・0004)
 * - 現在時刻は this.setNow(...) で決める
 * - 照会は画面の入口関数 showRoomAvailability を、this.api.asFetch({ tier: 'frontend', layer: 'api-client' }) を渡して呼ぶ。
 *   入口関数は tracedFn (layer screen) で包み、「画面 → API クライアント → backend」を 1 本のトレースに載せる
 * - 結果は画面の入口関数が返す画面の状態で確かめる (表示する内容はこの状態から作られる)
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Given, Then, When } from '@cucumber/cucumber';
import { tracedFn } from '@repo/test-support/tracer';
import {
  type RoomAvailabilityState,
  showRoomAvailability,
} from '../../apps/frontend/src/screens/RoomAvailability/showRoomAvailability';
import type { TokenProvider } from '../../apps/frontend/src/api/tokenProvider';
import {
  RESERVATION_EVENTS_COLUMNS as E,
  RESERVATION_EVENTS_TABLE,
  RESERVATIONS_COLUMNS as R,
  RESERVATIONS_TABLE,
  ROOM_SLOT_OCCUPANCIES_COLUMNS as O,
  ROOM_SLOT_OCCUPANCIES_TABLE,
  ROOMS_COLUMNS as M,
  ROOMS_TABLE,
} from '../../packages/contracts/db/tables';
import type { D2World } from '../support/world';

const FRONTEND_TIER = 'frontend';
/** 業務のタイムゾーン Asia/Tokyo の時差 (ADR 0017) */
const BUSINESS_OFFSET = '+09:00';
const SLOT_MINUTES = 30;
/** 社員の指定が無い文 (「社員が」「予約がある」) の社員 */
const DEFAULT_EMPLOYEE = 'a';
/** 予約の前提を入れた時刻 (イベントの発生時刻。照会の結果に影響しない) */
const SEEDED_AT = '2026-11-05T09:00:00+09:00';

/** 画面の入口関数。トレースの画面の層の部品にする */
const showRoomAvailabilityScreen = tracedFn(
  '空き状況画面',
  'showRoomAvailability',
  showRoomAvailability,
  {
    tier: FRONTEND_TIER,
    layer: 'screen',
  },
);

/** シナリオごとの観測結果 (World はシナリオごとに作り直される) */
interface ScenarioState {
  /** 有効な予約を入れた会議室名 (「予約の無い会議室」の判定に使う) */
  reservedRooms: Set<string>;
  result?: RoomAvailabilityState;
}
const states = new WeakMap<D2World, ScenarioState>();
function stateOf(world: D2World): ScenarioState {
  let s = states.get(world);
  if (!s) {
    s = { reservedRooms: new Set() };
    states.set(world, s);
  }
  return s;
}

/** 「社員A」「A」「」から社員の呼び名 (test-employee-<x> / employee-<x> の x) を取る。省略できる捕捉は、合わないとき null で渡る (cucumber) */
function employeeKey(text: string | null | undefined): string {
  const who = (text ?? '').replace(/^社員/, '');
  return who.length > 0 ? who.toLowerCase() : DEFAULT_EMPLOYEE;
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

/** 終了の時刻を画面の入力値にする。翌日の時刻は 24 時以降の時刻 (翌日 0:00 → 24:00) で入れる */
function endTimeInput(time: string, nextDay: boolean): string {
  if (!nextDay) return time;
  const [h, m] = time.split(':').map(Number);
  return `${h + 24}:${String(m).padStart(2, '0')}`;
}

async function roomIdOf(world: D2World, roomName: string): Promise<string> {
  const res = await world.db.query<{ room_id: string }>(
    `SELECT ${M.room_id} FROM ${ROOMS_TABLE} WHERE ${M.room_name} = $1`,
    [roomName],
  );
  assert.equal(res.rows.length, 1, `${roomName} が登録されていない`);
  return res.rows[0].room_id;
}

/** 予約を 1 件入れる。有効な予約は占有の行も入れ、取り消した予約は取り消しのイベントを足して占有の行を入れない */
async function seedReservation(
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
  stateOf(world).reservedRooms.add(input.roomName);
}

async function show(
  world: D2World,
  employee: string,
  slot: { date: string; startTime: string; endTime: string },
): Promise<void> {
  stateOf(world).result = await showRoomAvailabilityScreen(slot, {
    tokens: testTokens(employeeKey(employee)),
    fetch: world.api.asFetch({ tier: FRONTEND_TIER, layer: 'api-client' }),
  });
}

function loadedRooms(world: D2World) {
  const result = stateOf(world).result;
  assert.ok(result, '空き状況を表示していない');
  assert.equal(result.kind, 'loaded', `照会が受け付けられなかった: ${JSON.stringify(result)}`);
  return result.kind === 'loaded' ? result.rooms : [];
}

function roomShown(world: D2World, roomName: string) {
  const room = loadedRooms(world).find((r) => r.roomName === roomName);
  assert.ok(room, `${roomName} が表示されていない`);
  return room;
}

function assertRejected(world: D2World, code: string): void {
  const result = stateOf(world).result;
  assert.ok(result, '空き状況を表示しようとしていない');
  assert.notEqual(result.kind, 'loaded', '空き状況が表示された');
  assert.deepEqual(result, { kind: 'error', code });
}

const AVAILABILITY: Record<string, 'available' | 'reserved'> = {
  空き: 'available',
  予約済み: 'reserved',
};

// ---- 前提 ----

Given(/^会議室が (\d+) 部屋登録されている$/, async function (this: D2World, count: string) {
  // 会議室は migration の初期データで入る (ADR 0003)。ここでは数を確かめるだけ
  const res = await this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${ROOMS_TABLE}`);
  assert.equal(res.rows[0].n, Number(count));
});

Given(
  /^会議室(\S+?)の (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(翌日)?(\d{1,2}:\d{2}) に(?:(社員\S+?)の)?予約がある$/,
  async function (
    this: D2World,
    room: string,
    date: string,
    start: string,
    nextDay: string | null | undefined,
    end: string,
    employee: string | null | undefined,
  ) {
    await seedReservation(this, {
      roomName: `会議室${room}`,
      startAt: businessDateTime(date, start),
      endAt: businessDateTime(date, end, Boolean(nextDay)),
      employee: employeeKey(employee),
      cancelled: false,
    });
  },
);

Given(
  /^会議室(\S+?)の (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) の予約が取り消されている$/,
  async function (this: D2World, room: string, date: string, start: string, end: string) {
    await seedReservation(this, {
      roomName: `会議室${room}`,
      startAt: businessDateTime(date, start),
      endAt: businessDateTime(date, end),
      employee: DEFAULT_EMPLOYEE,
      cancelled: true,
    });
  },
);

Given(
  /^会議室(\S+?)〜会議室(\S+?) の (\d+) 部屋が表示順 (\d+)〜(\d+) で登録されている$/,
  async function (
    this: D2World,
    firstRoom: string,
    lastRoom: string,
    count: string,
    firstOrder: string,
    lastOrder: string,
  ) {
    // 会議室は migration の初期データで入る (ADR 0003)。文の会議室名と表示順が登録どおりかを確かめる
    const first = firstRoom.codePointAt(0) ?? 0;
    const n = Number(count);
    assert.equal(lastRoom.codePointAt(0), first + n - 1, '会議室名の範囲と部屋数が合わない');
    assert.equal(Number(lastOrder) - Number(firstOrder) + 1, n, '表示順の範囲と部屋数が合わない');
    const expected = Array.from({ length: n }, (_, i) => ({
      room_name: `会議室${String.fromCodePoint(first + i)}`,
      display_order: Number(firstOrder) + i,
    }));
    const res = await this.db.query<{ room_id: string; room_name: string; display_order: number }>(
      `SELECT ${M.room_id}, ${M.room_name}, ${M.display_order} FROM ${ROOMS_TABLE} ORDER BY ${M.display_order}`,
    );
    assert.deepEqual(
      res.rows.map((r) => ({ room_name: r.room_name, display_order: Number(r.display_order) })),
      expected,
    );
    // 並びを確かめる意味を持たせるため、表の物理的な並びを表示順の逆にする (内容は変えない)。
    // 初期データは表示順どおりに入るので、並べ替えを忘れた照会でも偶然 1〜5 の順に返ってしまうのを防ぐ
    await this.db.query(`DELETE FROM ${ROOMS_TABLE}`);
    for (const r of [...res.rows].reverse()) {
      await this.db.query(
        `INSERT INTO ${ROOMS_TABLE} (${M.room_id}, ${M.room_name}, ${M.display_order}) VALUES ($1, $2, $3)`,
        [r.room_id, r.room_name, r.display_order],
      );
    }
  },
);

Given(
  /^現在が (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2}) である$/,
  async function (this: D2World, date: string, time: string) {
    this.setNow(businessDateTime(date, time).toISOString());
  },
);

// ---- 操作 ----

When(
  /^社員(\S*)が (\d{4}-\d{2}-\d{2}) (\d{1,2}:\d{2})-(\d{1,2}:\d{2}) の空き状況を表示する$/,
  async function (this: D2World, employee: string, date: string, start: string, end: string) {
    await show(this, employee, { date, startTime: start, endTime: end });
  },
);

When(
  /^社員(\S*)が (\d{4}-\d{2}-\d{2}) の開始時刻 (\d{1,2}:\d{2})・終了時刻 (翌日 )?(\d{1,2}:\d{2})(?: \(24:00\))? で空き状況を表示(?:しようと)?する$/,
  async function (
    this: D2World,
    employee: string,
    date: string,
    start: string,
    nextDay: string | null | undefined,
    end: string,
  ) {
    await show(this, employee, {
      date,
      startTime: start,
      endTime: endTimeInput(end, Boolean(nextDay)),
    });
  },
);

// ---- 結果 ----

Then(/^(\d+) 部屋すべてが会議室ごとに表示される$/, async function (this: D2World, count: string) {
  const rooms = loadedRooms(this);
  const registered = await this.db.query<{ room_name: string }>(
    `SELECT ${M.room_name} FROM ${ROOMS_TABLE} ORDER BY ${M.display_order}`,
  );
  assert.equal(rooms.length, Number(count));
  // 会議室ごとに 1 行ずつ、登録した全会議室が出る
  assert.deepEqual(
    rooms.map((r) => r.roomName).sort(),
    registered.rows.map((r) => r.room_name).sort(),
  );
  for (const r of rooms) assert.ok(['available', 'reserved'].includes(r.availability));
});

Then(
  /^会議室(\S+?)は(予約済み|空き)と表示される$/,
  async function (this: D2World, room: string, availability: string) {
    assert.equal(roomShown(this, `会議室${room}`).availability, AVAILABILITY[availability]);
  },
);

Then('予約の無い会議室は空きと表示される', async function (this: D2World) {
  const reserved = stateOf(this).reservedRooms;
  const others = loadedRooms(this).filter((r) => !reserved.has(r.roomName));
  assert.ok(others.length > 0, '予約の無い会議室が表示されていない');
  for (const r of others) assert.equal(r.availability, 'available', `${r.roomName} が空きでない`);
});

Then(
  /^会議室(\S+?)は予約済みとだけ表示され、予約者である(社員\S+?)の名前は表示されない$/,
  async function (this: D2World, room: string, employee: string) {
    const shown = roomShown(this, `会議室${room}`);
    // 表示する項目は会議室 ID・会議室名・空き状況だけ (予約者の項目が無い)
    assert.deepEqual(Object.keys(shown).sort(), ['availability', 'roomId', 'roomName']);
    assert.equal(shown.availability, 'reserved');
    // 画面の状態のどこにも予約者 (社員 ID・呼び名) が出ない
    const text = JSON.stringify(stateOf(this).result);
    const key = employeeKey(employee);
    assert.ok(!text.includes(`employee-${key}`), '予約者の社員 ID が表示されている');
    assert.ok(!text.includes(employee), '予約者の名前が表示されている');
  },
);

Then(
  /^会議室名が (\S+) の順に並んで表示される$/,
  async function (this: D2World, orderedNames: string) {
    // 画面の状態の会議室の並び (画面はこの順で一覧を出す) が文の順と一致する
    assert.deepEqual(
      loadedRooms(this).map((r) => r.roomName),
      orderedNames.split('・'),
    );
  },
);

Then('照会は受け付けられる', async function (this: D2World) {
  loadedRooms(this);
});

Then('空き状況は表示されず、時間帯が正しくないことが示される', async function (this: D2World) {
  assertRejected(this, 'INVALID_TIME_RANGE');
});

Then(
  '空き状況は表示されず、時刻は 30 分刻みで指定することが示される',
  async function (this: D2World) {
    assertRejected(this, 'NOT_ON_30_MINUTES');
  },
);
