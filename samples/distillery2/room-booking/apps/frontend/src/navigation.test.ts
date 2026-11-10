import { describe, expect, it } from 'vitest';
import { matchRoute, resolveReturnPath } from './navigation';

const routes = [
  { path: '/availability', name: 'availability' },
  { path: '/reservations/:reservationId/cancel', name: 'cancel' },
  { path: '/auth/callback', name: 'callback' },
];

describe('画面の照合', () => {
  it('固定のpathの場合_同じpathの画面を選ぶこと', () => {
    // Arrange
    const pathname = '/auth/callback';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m).toEqual({ route: routes[2], params: {} });
  });

  it('パラメータを含むpathの場合_区切りの値をパラメータとして取り出すこと', () => {
    // Arrange
    const pathname = '/reservations/r-1/cancel';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m).toEqual({ route: routes[1], params: { reservationId: 'r-1' } });
  });

  it('パラメータの区切りが符号化されている場合_復号した値を取り出すこと', () => {
    // Arrange
    const pathname = '/reservations/r%201/cancel';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m).toEqual({ route: routes[1], params: { reservationId: 'r 1' } });
  });

  it('パラメータの区切りの符号化が壊れている場合_例外を出さずそのままの値を取り出すこと', () => {
    // Arrange
    const pathname = '/reservations/%E0/cancel';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m).toEqual({ route: routes[1], params: { reservationId: '%E0' } });
  });

  it('パラメータの区切りが空の場合_合わないこと', () => {
    // Arrange
    const pathname = '/reservations/cancel';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m).toBeUndefined();
  });

  it('pathが/の場合_表の先頭の画面を選ぶこと', () => {
    // Arrange
    const pathname = '/';

    // Act
    const m = matchRoute(routes, pathname);

    // Assert
    expect(m?.route).toBe(routes[0]);
  });
});

describe('サインイン後の戻り先', () => {
  it('同じオリジンのpathの場合_クエリを含めてそのpathへ戻ること', () => {
    // Arrange
    const state = '/availability?date=2026-11-10';

    // Act
    const path = resolveReturnPath(state, '/availability');

    // Assert
    expect(path).toBe('/availability?date=2026-11-10');
  });

  it('stateが無いか別のオリジンを指す場合_先頭の画面へ戻ること', () => {
    // Arrange
    const states = [undefined, '', 'https://evil.example/', '//evil.example/', '/\\evil.example'];

    // Act
    const paths = states.map((s) => resolveReturnPath(s, '/availability'));

    // Assert
    expect(paths).toEqual(states.map(() => '/availability'));
  });
});
