/**
 * 貸出受付画面の描画 (LoanRegisterView) の単体テスト。
 * 構造の正は packages/ui/stories/LoanRegister.stories.tsx (Default / Completed / Error)。
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoanRegisterView } from './LoanRegisterScreen';

const patron = { patronNumber: 'P-00000001', name: '山田 花子' };
const book = {
  bookId: '0b6f3c1e-2a4d-4e8f-9b1a-3c5d7e9f1a2b',
  title: '吾輩は猫である',
  status: 'available' as const,
};

describe('LoanRegisterView', () => {
  it('登録前の場合、在庫ありの書籍と登録ボタンを表示すること', () => {
    // Arrange
    const phase = { kind: 'default' as const };

    // Act
    const html = renderToStaticMarkup(
      <LoanRegisterView patron={patron} book={book} phase={phase} />,
    );

    // Assert
    expect(html).toContain('吾輩は猫である');
    expect(html).toContain('在庫あり');
    expect(html).toContain('貸出を登録する');
    expect(html).not.toContain('山田 花子');
  });

  it('登録前の場合、story と同じく利用者・書籍・貸出日・返却期限の行をこの順に並べること', () => {
    // Arrange
    const phase = { kind: 'default' as const };

    // Act
    const html = renderToStaticMarkup(
      <LoanRegisterView patron={patron} book={book} phase={phase} />,
    );

    // Assert
    const labels = [...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1]);
    expect(labels).toEqual(['利用者', '書籍', '貸出日', '返却期限']);
    expect(html).toContain('<dd></dd>');
  });

  it('貸出が登録された場合、応答の返却期限と貸出中の書籍状態を表示すること', () => {
    // Arrange
    const phase = {
      kind: 'registered' as const,
      loanId: '3f8a2d6c-1b4e-4a7f-9c2d-5e8b1a4d7c0e',
      loanedOn: '2026-10-01',
      dueDate: '2026-10-15',
      bookStatus: 'on_loan' as const,
    };

    // Act
    const html = renderToStaticMarkup(
      <LoanRegisterView patron={patron} book={book} phase={phase} />,
    );

    // Assert
    expect(html).toContain('貸出を登録しました');
    expect(html).toContain('返却期限は 2026-10-15 です');
    expect(html).toContain('貸出中');
    expect(html).toContain('<dd>2026-10-01</dd>');
    expect(html).toContain('続けて貸出を受け付ける');
    expect(html).not.toContain('>貸出を登録する<');
  });

  it('貸し出せなかった場合、貸出できない旨と理由を表示すること', () => {
    // Arrange
    const phase = {
      kind: 'rejected' as const,
      code: 'book_on_loan' as const,
      message: 'この書籍は貸出中のため貸し出せません',
    };

    // Act
    const html = renderToStaticMarkup(
      <LoanRegisterView patron={patron} book={book} phase={phase} />,
    );

    // Assert
    expect(html).toContain('role="alert"');
    expect(html).toContain('貸出を登録できませんでした');
    expect(html).toContain('この書籍は貸出中のため貸し出せません');
  });
});
