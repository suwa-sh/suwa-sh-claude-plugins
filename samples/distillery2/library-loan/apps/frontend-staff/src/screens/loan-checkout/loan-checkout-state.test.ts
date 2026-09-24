/**
 * 貸出登録 (register-loan) — frontend-staff / 貸出受付画面の状態
 *
 * 出典: 契約 createLoan の応答 (201 / 400 / 404 / 409)、
 *       画面 Storybook Screens/LoanCheckout の variant (default / completed / notLendable / error)、
 *       シナリオ「貸出中の書籍は同じ書籍として貸し出せない」「削除済みの書籍は貸し出せない」
 *       (ならば 貸出できない旨が表示され貸出は記録されない)。
 */
import { describe, expect, it } from 'vitest';
import created201 from '../../../../../packages/contracts/api/stubs/createLoan.201.json';
import badRequest400 from '../../../../../packages/contracts/api/stubs/createLoan.400.json';
import notFound404 from '../../../../../packages/contracts/api/stubs/createLoan.404.json';
import conflict409 from '../../../../../packages/contracts/api/stubs/createLoan.409.json';
import type { Loan, Problem } from '../../api-client/loan-api-types';
import { initialLoanCheckoutView, toLoanCheckoutVariant, toLoanCheckoutView } from './loan-checkout-state';

const input = { patronNumber: 'P000123', bookId: '11111111-1111-4111-8111-111111111111' };

describe('貸出受付画面の状態', () => {
  it('toLoanCheckoutVariant_貸出登録が201で成功した場合_completedになること', () => {
    // Arrange
    const status = 201;

    // Act
    const variant = toLoanCheckoutVariant(status);

    // Assert
    expect(variant).toBe('completed');
  });

  it('toLoanCheckoutVariant_貸出可否条件で409が返った場合_notLendableになること', () => {
    // Arrange
    const status = 409;

    // Act
    const variant = toLoanCheckoutVariant(status);

    // Assert
    expect(variant).toBe('notLendable');
  });

  it('toLoanCheckoutVariant_削除済みの書籍・利用者で404が返った場合_notLendableになること', () => {
    // Arrange
    const status = 404;

    // Act
    const variant = toLoanCheckoutVariant(status);

    // Assert
    expect(variant).toBe('notLendable');
  });

  it('toLoanCheckoutVariant_入力不正で400が返った場合_入力欄にエラーを出すdefaultになること', () => {
    // Arrange
    const status = 400;

    // Act
    const variant = toLoanCheckoutVariant(status);

    // Assert
    expect(variant).toBe('default');
  });

  it('toLoanCheckoutVariant_権限なしの403が返った場合_errorになること', () => {
    // Arrange
    const status = 403;

    // Act
    const variant = toLoanCheckoutVariant(status);

    // Assert
    expect(variant).toBe('error');
  });

  it('initialLoanCheckoutView_入力前の場合_空入力のdefaultであること', () => {
    // Arrange / Act
    const view = initialLoanCheckoutView();

    // Assert
    expect(view).toEqual({ variant: 'default', input: { patronNumber: '', bookId: '' } });
  });
});

describe('貸出受付画面の状態の組み立て toLoanCheckoutView', () => {
  it('toLoanCheckoutView_貸出が登録された場合_返却期限を含む貸出内容と完了メッセージを出すこと', () => {
    // Arrange
    const loan = created201 as Loan;

    // Act
    const view = toLoanCheckoutView(input, { kind: 'created', status: 201, loan });

    // Assert
    expect(view.variant).toBe('completed');
    expect(view.alert).toEqual({
      variant: 'success',
      title: '貸出を登録しました',
      message: `利用者 ${loan.patronNumber} に貸し出しました。返却期限を利用者にお伝えください。`,
    });
    expect(view.loan).toEqual({
      loanId: loan.loanId,
      bookId: loan.bookId,
      patronNumber: loan.patronNumber,
      loanedOn: loan.loanedOn,
      loanPeriodDays: loan.loanPeriodDays,
      dueOn: loan.dueOn,
      daysLeft: loan.loanPeriodDays,
    });
  });

  it('toLoanCheckoutView_書籍起因で409が返った場合_貸出できない旨を書籍欄と警告に出し貸出内容を出さないこと', () => {
    // Arrange
    const problem = conflict409 as Problem;

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 409, problem });

    // Assert
    expect(view).toEqual({
      variant: 'notLendable',
      input,
      bookError: problem.detail,
      alert: { variant: 'warning', title: problem.title, message: problem.detail },
    });
  });

  it('toLoanCheckoutView_延滞中の貸出を持つ利用者で409が返った場合_貸出できない旨を利用者欄に出すこと', () => {
    // Arrange
    const problem: Problem = {
      type: 'https://library.example/problems/loan-not-allowed',
      title: 'この利用者には貸し出せません',
      status: 409,
      code: 'patron-has-overdue-loan',
      detail: '延滞中の貸出があるため貸し出せません',
    };

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 409, problem });

    // Assert
    expect(view.variant).toBe('notLendable');
    expect(view.patronError).toBe('延滞中の貸出があるため貸し出せません');
    expect(view.bookError).toBeUndefined();
    expect(view.alert?.title).toBe('この利用者には貸し出せません');
  });

  it('toLoanCheckoutView_削除済みで404が返った場合_貸出できない旨を出し貸出内容を出さないこと', () => {
    // Arrange
    const problem = notFound404 as Problem;

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 404, problem });

    // Assert
    expect(view.variant).toBe('notLendable');
    expect(view.alert).toEqual({ variant: 'warning', title: problem.title, message: problem.detail });
    expect(view.loan).toBeUndefined();
  });

  it('toLoanCheckoutView_入力不正で400が返った場合_項目ごとのエラーを入力欄に出すこと', () => {
    // Arrange
    const problem = badRequest400 as Problem;

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 400, problem });

    // Assert
    expect(view).toEqual({ variant: 'default', input, bookError: '書籍IDは必須です' });
  });

  it('toLoanCheckoutView_400に項目エラーが無い場合_エラー表示にすること', () => {
    // Arrange
    const problem: Problem = { type: 'about:blank', title: '入力内容に誤りがあります', status: 400 };

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 400, problem });

    // Assert
    expect(view.variant).toBe('error');
    expect(view.alert).toEqual({ variant: 'destructive', title: '貸出を登録できませんでした', message: '入力内容に誤りがあります' });
  });

  it('toLoanCheckoutView_権限なしの403が返った場合_サーバの説明をエラーとして出すこと', () => {
    // Arrange
    const problem: Problem = {
      type: 'https://library.example/problems/forbidden',
      title: '操作する権限がありません',
      status: 403,
      detail: '貸出の登録は司書だけが行えます',
    };

    // Act
    const view = toLoanCheckoutView(input, { kind: 'problem', status: 403, problem });

    // Assert
    expect(view.variant).toBe('error');
    expect(view.alert).toEqual({ variant: 'destructive', title: '貸出を登録できませんでした', message: '貸出の登録は司書だけが行えます' });
  });

  it('toLoanCheckoutView_本文の無い失敗応答の場合_貸出されていない旨のエラーを出すこと', () => {
    // Arrange
    const result = { kind: 'problem', status: 502, problem: null } as const;

    // Act
    const view = toLoanCheckoutView(input, result);

    // Assert
    expect(view.variant).toBe('error');
    expect(view.alert?.message).toBe('貸出は登録されていません。時間をおいて再度お試しください。');
  });

  it('toLoanCheckoutView_通信に失敗した場合_storyの通信失敗メッセージを出すこと', () => {
    // Arrange
    const result = { kind: 'network-error' } as const;

    // Act
    const view = toLoanCheckoutView(input, result);

    // Assert
    expect(view).toEqual({
      variant: 'error',
      input,
      alert: {
        variant: 'destructive',
        title: '貸出を登録できませんでした',
        message: '通信に失敗しました。貸出は登録されていません。時間をおいて再度お試しください。',
      },
    });
  });
});
