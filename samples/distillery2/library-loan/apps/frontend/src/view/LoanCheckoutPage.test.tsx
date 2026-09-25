/**
 * 貸出受付画面 (LoanCheckoutScreen) の構造の単体テスト。
 * 画面状態は story (packages/ui/stories/LoanCheckout.stories.tsx) の Default / Error / Completed に対応する。
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Loan } from '../../../../packages/contracts/api/types';
import { LoanCheckoutScreen } from './LoanCheckoutPage';

const loan: Loan = {
  book_title: '吾輩は猫である',
  copy_id: '11111111-1111-4111-8111-111111111111',
  copy_status: 'on_loan',
  due_on: '2026-09-15',
  fulfilled_reservation_id: null,
  loan_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  loaned_on: '2026-09-01',
  patron_number: 'P-2026-00001',
  returned_on: null,
  status: 'on_loan',
};

function render(element: ReactElement): Document {
  return new DOMParser().parseFromString(renderToStaticMarkup(element), 'text/html');
}

describe('貸出受付画面', () => {
  it('未送信の場合_結果のお知らせを出さずフォームだけを表示すること', () => {
    // Arrange
    const element = <LoanCheckoutScreen />;

    // Act
    const doc = render(element);

    // Assert
    expect({
      alerts: doc.querySelectorAll('[role="alert"],[role="status"]').length,
      inputs: [...doc.querySelectorAll('input')].map((i) => i.name),
    }).toEqual({ alerts: 0, inputs: ['patronNo', 'copyId'] });
  });

  it('貸し出した場合_書籍タイトルと返却期限を成功のお知らせに表示すること', () => {
    // Arrange
    const element = <LoanCheckoutScreen view={{ kind: 'success', loan }} />;

    // Act
    const doc = render(element);

    // Assert
    const text = doc.querySelector('[role="status"]')?.textContent ?? '';
    expect([
      text.includes('貸し出しました'),
      text.includes('吾輩は猫である'),
      text.includes('2026-09-15'),
    ]).toEqual([true, true, true]);
  });

  it('貸し出せない場合_エラーのお知らせにタイトルと詳細を表示すること', () => {
    // Arrange
    const element = (
      <LoanCheckoutScreen
        view={{ kind: 'error', title: '貸し出せません', detail: 'この蔵書は貸出中です。' }}
        lastValues={{ patronNo: 'P-2026-00002', copyId: '22222222-2222-4222-8222-222222222222' }}
      />
    );

    // Act
    const doc = render(element);

    // Assert
    const text = doc.querySelector('[role="alert"]')?.textContent ?? '';
    expect({
      title: text.includes('貸し出せません'),
      detail: text.includes('この蔵書は貸出中です。'),
      patronNo: doc.querySelector<HTMLInputElement>('input[name="patronNo"]')?.value,
    }).toEqual({ title: true, detail: true, patronNo: 'P-2026-00002' });
  });

  it('項目エラーがある場合_該当する入力欄にエラーを表示すること', () => {
    // Arrange
    const element = (
      <LoanCheckoutScreen
        view={{
          kind: 'error',
          title: '入力内容に誤りがあります',
          fieldErrors: { patronNo: '利用者番号は必須です' },
        }}
      />
    );

    // Act
    const doc = render(element);

    // Assert
    expect(doc.body.textContent).toContain('利用者番号は必須です');
  });

  it('送信中の場合_貸し出すボタンを押せないこと', () => {
    // Arrange
    const element = <LoanCheckoutScreen submitting />;

    // Act
    const doc = render(element);

    // Assert
    expect(doc.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
});
