import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomAvailabilityScreen } from './RoomAvailabilityScreen';

// React に act の環境であることを伝える (testing-library を使わずに描画する)
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;

const tokens = {
  getAccessToken: async () => 'test-employee-a',
  signIn: async () => {},
  getDisplayName: async () => '社員A',
};

/** 照会に決めた応答を返す fetch の代わり */
const fetchReturning = (status: number, body: unknown) =>
  (async () =>
    ({
      status,
      text: async () => JSON.stringify(body),
    }) as unknown as Response) as typeof fetch;

/**
 * 画面を描き、照会のボタンを押して応答の反映まで待つ。
 * 既定の現在は 2026-11-10 10:00 (日本時間) で、初期の時間帯 (今日の 9:00〜10:00) は過去になる
 */
async function renderAndSearch(
  api: typeof globalThis.fetch,
  now = new Date('2026-11-10T01:00:00Z'),
  moves: string[] = [],
) {
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <RoomAvailabilityScreen
        tokens={tokens}
        fetch={api}
        clock={{ now: () => now }}
        navigate={(p) => moves.push(p)}
      />,
    );
  });
  const form = container.querySelector('form');
  await act(async () => {
    form?.requestSubmit();
  });
  return container;
}

afterEach(() => {
  container?.remove();
  container = undefined;
});

describe('空き状況の画面', () => {
  it('過去の時間帯を照会した場合_会議室ごとの空き状況を出し予約するボタンは出さないこと', async () => {
    // Arrange
    const api = fetchReturning(200, {
      rooms: [
        { roomId: 'room-1', name: '会議室A', availability: 'reserved' },
        { roomId: 'room-2', name: '会議室B', availability: 'available' },
      ],
    });

    // Act
    const view = await renderAndSearch(api);

    // Assert
    const rows = [...view.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect({
      rows,
      buttons: [...view.querySelectorAll('tbody button')].length,
      hasReserveText: view.textContent?.includes('予約する') ?? false,
    }).toEqual({
      rows: ['会議室A予約済み', '会議室B空き'],
      buttons: 0,
      hasReserveText: false,
    });
  });

  it('これからの時間帯を照会した場合_空きの会議室にだけ予約するボタンを出すこと', async () => {
    // Arrange
    const api = fetchReturning(200, {
      rooms: [
        { roomId: 'room-1', name: '会議室A', availability: 'reserved' },
        { roomId: 'room-2', name: '会議室B', availability: 'available' },
      ],
    });

    // Act
    const view = await renderAndSearch(api, new Date('2026-11-08T23:00:00Z'));

    // Assert
    const rows = [...view.querySelectorAll('tbody tr')].map((tr) => tr.textContent);
    expect(rows).toEqual(['会議室A予約済み予約できません', '会議室B空き予約する']);
  });

  it('予約するを押した場合_選んだ会議室と照会した時間帯をクエリに入れて予約の画面へ移ること', async () => {
    // Arrange
    const api = fetchReturning(200, {
      rooms: [{ roomId: 'room-2', name: '会議室B', availability: 'available' }],
    });
    const moves: string[] = [];
    const view = await renderAndSearch(api, new Date('2026-11-08T23:00:00Z'), moves);

    // Act
    await act(async () => {
      view.querySelector<HTMLButtonElement>('tbody button')?.click();
    });

    // Assert
    const url = new URL(moves[0] ?? '/', 'http://localhost');
    expect({ pathname: url.pathname, query: Object.fromEntries(url.searchParams) }).toEqual({
      pathname: '/reservations/new',
      query: { roomId: 'room-2', date: '2026-11-09', startTime: '09:00', endTime: '10:00' },
    });
  });

  it('APIが業務のエラーを返した場合_一覧を出さずエラーのコードに応じた理由を出すこと', async () => {
    // Arrange
    const api = fetchReturning(422, {
      type: 'about:blank',
      title: '時間帯が正しくありません',
      status: 422,
      code: 'INVALID_TIME_RANGE',
    });

    // Act
    const view = await renderAndSearch(api);

    // Assert
    expect({
      table: view.querySelector('table') !== null,
      code: view.querySelector('[data-error-code]')?.getAttribute('data-error-code'),
    }).toEqual({ table: false, code: 'INVALID_TIME_RANGE' });
  });

  it('APIが業務のエラーを返した後に時間帯を変えた場合_変える前の時間帯に対するエラーを消すこと', async () => {
    // Arrange
    const api = fetchReturning(422, {
      type: 'about:blank',
      title: '時間帯が正しくありません',
      status: 422,
      code: 'INVALID_TIME_RANGE',
    });
    const view = await renderAndSearch(api);
    const errorBefore = view.querySelector('[data-error-code]')?.getAttribute('data-error-code');
    const end = view.querySelectorAll('select')[1];

    // Act
    await act(async () => {
      end.value = '11:00';
      end.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Assert
    expect({
      errorBefore,
      error: view.querySelector('[data-error-code]'),
      end: view.querySelectorAll('select')[1].value,
    }).toEqual({ errorBefore: 'INVALID_TIME_RANGE', error: null, end: '11:00' });
  });
});
