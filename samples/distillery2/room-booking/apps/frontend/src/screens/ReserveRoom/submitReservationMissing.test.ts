import { describe, expect, it } from 'vitest';
import type { TokenProvider } from '../../api/tokenProvider';
import { submitReservation } from './submitReservation';

// SPEC-002-01-8・01-9: 会議室・日付・開始時刻・終了時刻のどれかが未入力のときは、予約を送らずに止め、
// 未入力の項目ごとに入力を促す。項目の名前は画面部品の ReservationFormField (missingReservationFields の返す値) に合わせる

/** 生成クライアントに渡す fetch の代わり。呼ばれた回数だけ記録し、成立の応答を返す (未入力なら呼ばれないこと) */
function recordingFetch() {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return {
      status: 201,
      text: async () =>
        JSON.stringify({
          reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
          roomId: 'room-1',
          roomName: '会議室A',
          startAt: '2026-11-10T10:00:00+09:00',
          endAt: '2026-11-10T11:00:00+09:00',
          reservedBy: 'employee-a',
          status: 'reserved',
        }),
    } as unknown as Response;
  }) as typeof fetch;
  return { fn, calls };
}

const tokens: TokenProvider = {
  getAccessToken: async () => 'test-employee-a',
  signIn: async () => {},
};

describe('予約の画面の入口関数 (未入力の項目)', () => {
  it('会議室が未入力の場合_予約を送らず会議室を選ぶよう示す状態を返すこと', async () => {
    // Arrange
    const api = recordingFetch();

    // Act
    const state = await submitReservation(
      { roomId: '', date: '2026-11-10', startTime: '10:00', endTime: '11:00' },
      { tokens, fetch: api.fn },
    );

    // Assert
    expect({ calls: api.calls, state }).toEqual({
      calls: [],
      state: { kind: 'missing', fields: ['roomId'] },
    });
  });

  it('日付と開始時刻と終了時刻が未入力の場合_予約を送らずそれぞれを選ぶよう示す状態を返すこと', async () => {
    // Arrange
    const api = recordingFetch();

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '', startTime: '', endTime: '' },
      { tokens, fetch: api.fn },
    );

    // Assert
    expect({ calls: api.calls, state }).toEqual({
      calls: [],
      state: { kind: 'missing', fields: ['date', 'startTime', 'endTime'] },
    });
  });

  it('終了時刻だけが未入力の場合_予約を送らず終了時刻だけを選ぶよう示す状態を返すこと', async () => {
    // Arrange
    const api = recordingFetch();

    // Act
    const state = await submitReservation(
      { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '' },
      { tokens, fetch: api.fn },
    );

    // Assert
    expect({ calls: api.calls, state }).toEqual({
      calls: [],
      state: { kind: 'missing', fields: ['endTime'] },
    });
  });
});
