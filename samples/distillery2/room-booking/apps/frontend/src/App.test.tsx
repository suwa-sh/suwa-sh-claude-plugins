import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, navigate } from './App';

// ADR 0021: App.tsx は URL のクエリを読み、Route の element に 2 つ目の引数で渡す。
// 画面の照合は pathname だけで行い、popstate と navigate() で pathname と search を追う。

// React に act の環境であることを伝える (testing-library を使わずに描画する)
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const received = vi.hoisted(
  () => [] as { path: string; params: Record<string, string>; query: unknown }[],
);

// 画面の表を、受け取った引数を記録するだけの画面に差し替える (サインインを通さない public の画面)
vi.mock('./routes', () => ({
  routes: [
    {
      path: '/availability',
      element: (params: Record<string, string>, query?: Record<string, string>) => {
        received.push({ path: '/availability', params, query });
        return null;
      },
      public: true,
    },
    {
      path: '/rooms/:roomId',
      element: (params: Record<string, string>, query?: Record<string, string>) => {
        received.push({ path: '/rooms/:roomId', params, query });
        return null;
      },
      public: true,
    },
  ],
}));

// 本番のトークンの供給元 (OIDC クライアント) を読み込まない
vi.mock('./api/oidcTokenProvider', () => ({
  sessionTokenProvider: () => ({
    getAccessToken: async () => 'test-employee-a',
    signIn: async () => {},
    getDisplayName: async () => '社員A',
  }),
}));

let container: HTMLDivElement | undefined;
let root: Root | undefined;

async function renderAppAt(url: string) {
  window.history.replaceState(null, '', url);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<App />);
  });
}

const lastReceived = () => received[received.length - 1];

beforeEach(() => {
  received.length = 0;
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  container = undefined;
  root = undefined;
});

describe('App のクエリの受け渡し (ADR 0021)', () => {
  it('App_URLにクエリがある場合_同じ名前は最初の値を取ってelementの2つ目の引数で渡すこと', async () => {
    // Arrange
    const url = '/availability?roomId=room-1&date=2026-11-10&roomId=room-2';

    // Act
    await renderAppAt(url);

    // Assert
    expect(lastReceived()).toEqual({
      path: '/availability',
      params: {},
      query: { roomId: 'room-1', date: '2026-11-10' },
    });
  });

  it('App_URLにクエリが無い場合_空のオブジェクトをelementの2つ目の引数で渡すこと', async () => {
    // Arrange
    const url = '/availability';

    // Act
    await renderAppAt(url);

    // Assert
    expect(lastReceived()?.query).toEqual({});
  });

  it('App_パラメータとクエリがある場合_照合はpathnameだけで行いparamsとqueryを分けて渡すこと', async () => {
    // Arrange
    const url = '/rooms/room-1?date=2026-11-10';

    // Act
    await renderAppAt(url);

    // Assert
    expect(lastReceived()).toEqual({
      path: '/rooms/:roomId',
      params: { roomId: 'room-1' },
      query: { date: '2026-11-10' },
    });
  });

  it('App_navigateで同じpathのクエリだけが変わった場合_新しいクエリで描き直すこと', async () => {
    // Arrange
    await renderAppAt('/availability?date=2026-11-10');

    // Act
    await act(async () => {
      navigate('/availability?date=2026-11-11');
    });

    // Assert
    expect(lastReceived()?.query).toEqual({ date: '2026-11-11' });
  });
});
