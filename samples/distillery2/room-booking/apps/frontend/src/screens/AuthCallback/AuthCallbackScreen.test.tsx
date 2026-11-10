import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthCallbackScreen } from './AuthCallbackScreen';

// React に act の環境であることを伝える (testing-library を使わずに描画する)
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;

async function render(completeSignIn: () => Promise<string | undefined>) {
  const navigated: string[] = [];
  const calls = { count: 0 };
  container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <AuthCallbackScreen
        tokens={{
          completeSignIn: () => {
            calls.count += 1;
            return completeSignIn();
          },
        }}
        fallbackPath="/availability"
        navigate={(p) => navigated.push(p)}
      />,
    );
  });
  return { navigated, calls, html: container.innerHTML };
}

afterEach(() => {
  container?.remove();
  container = undefined;
});

describe('サインインのコールバックの画面', () => {
  it('サインインが完了した場合_stateの画面へ戻り何も描かないこと', async () => {
    // Arrange
    const complete = async () => '/availability?date=2026-11-10';

    // Act
    const r = await render(complete);

    // Assert
    expect(r).toEqual({
      navigated: ['/availability?date=2026-11-10'],
      calls: { count: 1 },
      html: '',
    });
  });

  it('stateが無い場合_先頭の画面へ戻ること', async () => {
    // Arrange
    const complete = async () => undefined;

    // Act
    const r = await render(complete);

    // Assert
    expect(r.navigated).toEqual(['/availability']);
  });

  it('サインインの完了に失敗した場合_ログインが必要なことを示し画面を移らないこと', async () => {
    // Arrange
    const complete = async (): Promise<string | undefined> => {
      throw new Error('invalid state');
    };

    // Act
    const r = await render(complete);

    // Assert
    expect({
      navigated: r.navigated,
      code: container?.querySelector('[data-error-code]')?.getAttribute('data-error-code'),
    }).toEqual({
      navigated: [],
      code: 'UNAUTHENTICATED',
    });
  });
});
