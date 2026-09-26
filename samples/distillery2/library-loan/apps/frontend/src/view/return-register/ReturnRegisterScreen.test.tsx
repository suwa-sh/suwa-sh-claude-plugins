/**
 * 返却受付画面の描画 (ReturnRegisterView) の単体テスト。
 * 構造の正は packages/ui/stories/ReturnRegister.stories.tsx (Default / ReturnedAvailable / ReturnedOnHold / Error)。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReturnRegisterView } from './ReturnRegisterScreen';

const BOOK_ID = '4c1d7e2a-8b3f-4e6a-9c1d-2f5a8b3e6c9d';

describe('ReturnRegisterView', () => {
  it('登録前の場合、書籍IDの入力欄と返却の登録ボタンだけを表示すること', () => {
    // Arrange
    const phase = { kind: 'default' as const };

    // Act
    const html = renderToStaticMarkup(<ReturnRegisterView bookId={BOOK_ID} phase={phase} />);

    // Assert
    expect(html).toContain('返却受付');
    expect(html).toContain('>書籍ID<');
    expect(html).toContain(`value="${BOOK_ID}"`);
    expect(html).toContain('返却を登録する');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('role="status"');
  });

  it('予約のない書籍の返却が登録された場合、在庫ありになった旨を表示すること', () => {
    // Arrange
    const phase = {
      kind: 'returned' as const,
      bookId: BOOK_ID,
      loanId: '7e2b5d8a-3c6f-4a1e-8d4b-9f2c5e8a1b3d',
      returnedOn: '2026-10-15',
      bookStatus: 'available' as const,
    };

    // Act
    const html = renderToStaticMarkup(<ReturnRegisterView bookId="" phase={phase} />);

    // Assert
    expect(html).toContain('role="status"');
    expect(html).toContain('返却を登録しました');
    expect(html).toContain(`書籍ID ${BOOK_ID} の書籍は`);
    expect(html).toContain('在庫あり');
  });

  it('予約のある書籍の返却が登録された場合、予約待ちになり取り置く旨を表示すること', () => {
    // Arrange
    const phase = {
      kind: 'returned' as const,
      bookId: BOOK_ID,
      loanId: '1f4a7c2e-9d3b-4e6f-8a2c-5d8b1e4f7a3c',
      returnedOn: '2026-10-15',
      bookStatus: 'awaiting_pickup' as const,
    };

    // Act
    const html = renderToStaticMarkup(<ReturnRegisterView bookId="" phase={phase} />);

    // Assert
    expect(html).toContain('予約のある書籍です。取り置いてください');
    expect(html).toContain('予約待ち');
    expect(html).not.toContain('返却を登録しました');
  });

  it('返却できなかった場合、返却できない旨と理由を表示すること', () => {
    // Arrange
    const phase = {
      kind: 'rejected' as const,
      bookId: BOOK_ID,
      code: 'no_active_loan' as const,
      message: 'この書籍には返却できる貸出がありません',
    };

    // Act
    const html = renderToStaticMarkup(<ReturnRegisterView bookId={BOOK_ID} phase={phase} />);

    // Assert
    expect(html).toContain('role="alert"');
    expect(html).toContain('返却を登録できませんでした');
    expect(html).toContain('この書籍には返却できる貸出がありません');
  });
});
