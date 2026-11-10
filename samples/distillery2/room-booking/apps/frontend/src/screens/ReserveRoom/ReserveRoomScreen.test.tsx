import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ReserveRoomScreen } from './ReserveRoomScreen';

// React に act の環境であることを伝える (testing-library を使わずに描画する)
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;

const tokens = {
  getAccessToken: async () => 'test-employee-a',
  signIn: async () => {},
  getDisplayName: async () => '社員A',
};

const roomsBody = {
  rooms: [
    { roomId: 'room-1', name: '会議室A' },
    { roomId: 'room-2', name: '会議室B' },
  ],
};

const reservedBody = {
  reservationId: '3f6c2a1e-8b4d-4c7a-9e21-5d0b7a6f1c42',
  roomId: 'room-1',
  roomName: '会議室A',
  startAt: '2026-11-10T10:00:00+09:00',
  endAt: '2026-11-10T11:00:00+09:00',
  reservedBy: 'employee-a',
  status: 'reserved',
};

const internalErrorBody = {
  type: 'about:blank',
  title: '処理できませんでした',
  status: 500,
  code: 'INTERNAL_ERROR',
};

const respond = (status: number, body: unknown) =>
  ({ status, text: async () => JSON.stringify(body) }) as unknown as Response;

/** 会議室の一覧と予約に決めた応答を返す fetch の代わり。予約の要求の本文を記録する */
function fakeApi(
  reserve: () => Promise<Response>,
  listRooms: () => Promise<Response> = async () => respond(200, roomsBody),
) {
  const reservations: unknown[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/rooms') return listRooms();
    reservations.push(JSON.parse(String(init?.body)));
    return reserve();
  }) as typeof fetch;
  return { fn, reservations };
}

const fullQuery = { roomId: 'room-1', date: '2026-11-10', startTime: '10:00', endTime: '11:00' };

async function render(api: typeof fetch, query: Record<string, string>, moves: string[] = []) {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <ReserveRoomScreen
        tokens={tokens}
        fetch={api}
        query={query}
        navigate={(p) => moves.push(p)}
      />,
    );
  });
  return container;
}

const selectValues = (view: HTMLElement) =>
  [...view.querySelectorAll('select')].map((s) => s.value);

const buttonByText = (view: HTMLElement, text: string) =>
  [...view.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

/** select の値を変え、React の onChange に届く change を起こす */
const changeSelect = (select: HTMLSelectElement | undefined, value: string) => {
  if (!select) return;
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};

afterEach(() => {
  container?.remove();
  container = undefined;
});

describe('予約の画面', () => {
  it('空き状況から移ってきた場合_引き継いだ会議室と時間帯を入力の初期値にすること', async () => {
    // Arrange
    const api = fakeApi(async () => respond(201, reservedBody));

    // Act
    const view = await render(api.fn, fullQuery);

    // Assert
    expect({
      selects: selectValues(view),
      date: view.querySelector<HTMLInputElement>('input[type="date"]')?.value,
    }).toEqual({ selects: ['room-1', '10:00', '11:00'], date: '2026-11-10' });
  });

  it('選択肢に無い会議室を引き継いだ場合_会議室を空のままにしエラーを出さないこと', async () => {
    // Arrange
    const api = fakeApi(async () => respond(201, reservedBody));

    // Act
    const view = await render(api.fn, { ...fullQuery, roomId: 'no-such-room' });

    // Assert
    expect({
      room: selectValues(view)[0],
      error: view.querySelector('[data-error-code]'),
    }).toEqual({ room: '', error: null });
  });

  it('会議室の選択肢を読めないまま送信した場合_予約を送らずエラーを出すこと', async () => {
    // Arrange
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () => respond(500, internalErrorBody),
    );
    const view = await render(api.fn, fullQuery);

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect({
      sent: api.reservations.length,
      error: view.querySelector('[data-error-code]')?.getAttribute('data-error-code'),
    }).toEqual({ sent: 0, error: 'INTERNAL_ERROR' });
  });

  it('会議室の選択肢を読めなかった後に送信して読めた場合_選択肢にある会議室で予約を送ること', async () => {
    // Arrange
    let roomCalls = 0;
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () => {
        roomCalls += 1;
        return roomCalls === 1 ? respond(500, internalErrorBody) : respond(200, roomsBody);
      },
    );
    const view = await render(api.fn, fullQuery);

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect({
      sentRooms: api.reservations.map((r) => (r as { roomId: string }).roomId),
      completed: view.textContent?.includes('予約しました'),
    }).toEqual({ sentRooms: ['room-1'], completed: true });
  });

  it('会議室の選択肢を読めなかった後に読めて引き継いだ会議室が無かった場合_予約を送らず会議室を空にすること', async () => {
    // Arrange
    let roomCalls = 0;
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () => {
        roomCalls += 1;
        return roomCalls === 1 ? respond(500, internalErrorBody) : respond(200, roomsBody);
      },
    );
    const view = await render(api.fn, { ...fullQuery, roomId: 'no-such-room' });

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect({
      sent: api.reservations.length,
      room: selectValues(view)[0],
      error: view.querySelector('[data-error-code]'),
    }).toEqual({ sent: 0, room: '', error: null });
  });

  it('同じ画面のままクエリだけが変わった場合_移った先のクエリを入力の初期値にすること', async () => {
    // Arrange (ADR 0021: ブラウザの戻る・進むで同じ path の別のクエリへ移る)
    const api = fakeApi(async () => respond(201, reservedBody));
    container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const draw = (query: Record<string, string>) =>
      root.render(
        <ReserveRoomScreen tokens={tokens} fetch={api.fn} query={query} navigate={() => {}} />,
      );
    await act(async () => draw(fullQuery));

    // Act
    await act(async () =>
      draw({ roomId: 'room-2', date: '2026-11-11', startTime: '13:00', endTime: '14:00' }),
    );

    // Assert
    expect({
      selects: selectValues(container),
      date: container.querySelector<HTMLInputElement>('input[type="date"]')?.value,
    }).toEqual({ selects: ['room-2', '13:00', '14:00'], date: '2026-11-11' });
  });

  it('会議室を引き継がずに選択肢を読めなかった場合_読み直しのボタンで選択肢を読めること', async () => {
    // Arrange
    let roomCalls = 0;
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () => {
        roomCalls += 1;
        return roomCalls === 1 ? respond(500, internalErrorBody) : respond(200, roomsBody);
      },
    );
    const view = await render(api.fn, { ...fullQuery, roomId: '' });
    const errorBefore = view.querySelector('[data-error-code]')?.getAttribute('data-error-code');

    // Act
    await act(async () => {
      buttonByText(view, '会議室の一覧を読み直す')?.click();
    });

    // Assert
    expect({
      errorBefore,
      options: [...view.querySelectorAll('select')[0].options].map((o) => o.value),
      error: view.querySelector('[data-error-code]'),
      retry: buttonByText(view, '会議室の一覧を読み直す'),
      sent: api.reservations.length,
    }).toEqual({
      errorBefore: 'INTERNAL_ERROR',
      options: ['', 'room-1', 'room-2'],
      error: null,
      retry: undefined,
      sent: 0,
    });
  });

  it('会議室の選択肢を読めなかった場合_入力の上に理由と読み直しのボタンを出し引き継いだ日付と時刻を残すこと', async () => {
    // Arrange (見本 RoomsUnavailable)
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () => respond(500, internalErrorBody),
    );

    // Act
    const view = await render(api.fn, { ...fullQuery, roomId: '' });

    // Assert
    const form = view.querySelector('form');
    const alert = view.querySelector('[data-error-code]');
    const retry = buttonByText(view, '会議室の一覧を読み直す');
    expect({
      code: alert?.getAttribute('data-error-code'),
      alertInForm: form?.contains(alert ?? null),
      alertBeforeForm: Boolean(
        alert && form && alert.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
      errorInForm: form?.querySelector('[data-error-code]') ?? null,
      retryInForm: form?.contains(retry ?? null),
      options: [...view.querySelectorAll('select')[0].options].map((o) => o.value),
      selects: selectValues(view),
      date: view.querySelector<HTMLInputElement>('input[type="date"]')?.value,
    }).toEqual({
      code: 'INTERNAL_ERROR',
      alertInForm: false,
      alertBeforeForm: true,
      errorInForm: null,
      retryInForm: false,
      options: [''],
      selects: ['', '10:00', '11:00'],
      date: '2026-11-10',
    });
  });

  it('会議室の選択肢をサインインの切れで読めなかった場合_そのコードの理由を出すこと', async () => {
    // Arrange
    const api = fakeApi(
      async () => respond(201, reservedBody),
      async () =>
        respond(401, {
          type: 'about:blank',
          title: 'サインインが必要です',
          status: 401,
          code: 'UNAUTHENTICATED',
        }),
    );

    // Act
    const view = await render(api.fn, fullQuery);

    // Assert
    expect({
      code: view.querySelector('[data-error-code]')?.getAttribute('data-error-code'),
      retry: Boolean(buttonByText(view, '会議室の一覧を読み直す')),
    }).toEqual({ code: 'UNAUTHENTICATED', retry: true });
  });

  it('会議室の選択肢を読めた場合_読み直しのボタンを出さないこと', async () => {
    // Arrange
    const api = fakeApi(async () => respond(201, reservedBody));

    // Act
    const view = await render(api.fn, fullQuery);

    // Assert
    expect(buttonByText(view, '会議室の一覧を読み直す')).toBeUndefined();
  });

  it('会議室を選ばずに送信した場合_予約を送らず会議室を選ぶよう示すこと', async () => {
    // Arrange (SPEC-002-01-8)
    const api = fakeApi(async () => respond(201, reservedBody));
    const view = await render(api.fn, { ...fullQuery, roomId: '' });

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect({
      sent: api.reservations.length,
      roomPrompt: view.textContent?.includes('会議室を選んでください'),
      datePrompt: view.textContent?.includes('日付を選んでください'),
    }).toEqual({ sent: 0, roomPrompt: true, datePrompt: false });
  });

  it('予約が成立した場合_予約の内容を予約済みで出すこと', async () => {
    // Arrange
    const api = fakeApi(async () => respond(201, reservedBody));
    const view = await render(api.fn, fullQuery);

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect({
      sent: api.reservations,
      text: view.textContent?.includes('予約しました'),
      summary: view.querySelector('dl')?.textContent,
    }).toEqual({
      sent: [
        {
          roomId: 'room-1',
          startAt: '2026-11-10T10:00:00+09:00',
          endAt: '2026-11-10T11:00:00+09:00',
        },
      ],
      text: true,
      summary: '会議室会議室A日付2026-11-10時間帯10:00〜11:00状態予約済み',
    });
  });

  it('APIが業務のエラーを返した場合_エラーのコードに応じた理由を出すこと', async () => {
    // Arrange
    const api = fakeApi(async () =>
      respond(409, {
        type: 'about:blank',
        title: '時間帯が既存の予約と重なります',
        status: 409,
        code: 'SLOT_OVERLAPS',
      }),
    );
    const view = await render(api.fn, fullQuery);

    // Act
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });

    // Assert
    expect(view.querySelector('[data-error-code]')?.getAttribute('data-error-code')).toBe(
      'SLOT_OVERLAPS',
    );
  });

  it('APIが業務のエラーを返した後に入力を変えた場合_変える前の入力に対するエラーを消すこと', async () => {
    // Arrange
    const api = fakeApi(async () =>
      respond(409, {
        type: 'about:blank',
        title: '時間帯が既存の予約と重なります',
        status: 409,
        code: 'SLOT_OVERLAPS',
      }),
    );
    const view = await render(api.fn, fullQuery);
    await act(async () => {
      view.querySelector('form')?.requestSubmit();
    });
    const errorBefore = view.querySelector('[data-error-code]')?.getAttribute('data-error-code');

    // Act
    await act(async () => {
      changeSelect(view.querySelectorAll('select')[2], '12:00');
    });

    // Assert
    expect({
      errorBefore,
      error: view.querySelector('[data-error-code]'),
      end: selectValues(view)[2],
    }).toEqual({ errorBefore: 'SLOT_OVERLAPS', error: null, end: '12:00' });
  });

  it('送信中にもう一度送信した場合_予約を1回だけ送ること', async () => {
    // Arrange
    let release: (r: Response) => void = () => {};
    const api = fakeApi(
      () =>
        new Promise<Response>((resolve) => {
          release = resolve;
        }),
    );
    const view = await render(api.fn, fullQuery);
    const form = view.querySelector('form');

    // Act
    await act(async () => {
      form?.requestSubmit();
      form?.requestSubmit();
    });

    // Assert
    const sentWhileSubmitting = api.reservations.length;
    const disabled = buttonByText(view, '予約しています')?.disabled;
    await act(async () => release(respond(201, reservedBody)));
    expect({ sentWhileSubmitting, disabled }).toEqual({ sentWhileSubmitting: 1, disabled: true });
  });

  it('空き状況に戻るを押した場合_空き状況の画面へ移ること', async () => {
    // Arrange
    const moves: string[] = [];
    const api = fakeApi(async () => respond(201, reservedBody));
    const view = await render(api.fn, fullQuery, moves);

    // Act
    await act(async () => {
      buttonByText(view, '空き状況に戻る')?.click();
    });

    // Assert
    expect({ moves, sent: api.reservations.length }).toEqual({ moves: ['/availability'], sent: 0 });
  });
});
