/**
 * register-loan.test.ts — UC「貸出を登録する」画面ロジックの red baseline (d2-implement mode=scaffold)
 *
 * 中心の振る舞い: 貸出受付画面の入口関数が createLoan API を呼び、結果を画面の表示状態に変える。
 * 実装は mode=tier が書く。ティアのエントリ (./index) から次の名前で公開する想定:
 *   - submitLoanCheckout(input: { patronNumber: string; copyId: string }, options: { fetch: typeof fetch })
 *       : Promise<{ kind: 'success'; loan: Loan } | { kind: 'error'; title: string; detail?: string }>
 * 未実装のあいだは export が無く、assert が落ちる (import 失敗では落とさない)。
 * 応答の値は contract-slice.json の createLoan の examples (success / onLoan) から取る。
 */
import { describe, expect, it } from 'vitest';
import type { Loan, Problem } from '../../../packages/contracts/api/types';
import * as frontend from './index';

type CheckoutView =
  | { kind: 'success'; loan: Loan }
  | { kind: 'error'; title: string; detail?: string };
type SubmitLoanCheckout = (
  input: { patronNumber: string; copyId: string },
  options: { fetch: typeof fetch },
) => Promise<CheckoutView>;

const submitLoanCheckout = (frontend as Record<string, unknown>).submitLoanCheckout as
  | SubmitLoanCheckout
  | undefined;

function fakeFetch(status: number, body: unknown, contentType: string): typeof fetch {
  return async () =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

describe('貸出受付画面', () => {
  it('submitLoanCheckout_在庫ありの蔵書を貸し出した場合_返却期限つきの貸出を表示状態に返すこと', async () => {
    // Arrange
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
    const options = { fetch: fakeFetch(201, loan, 'application/json') };

    // Act
    const view = await submitLoanCheckout?.(
      { patronNumber: 'P-2026-00001', copyId: '11111111-1111-4111-8111-111111111111' },
      options,
    );

    // Assert
    expect(view).toEqual({ kind: 'success', loan });
  });

  it('submitLoanCheckout_貸出中の蔵書を貸し出そうとした場合_貸し出せない旨のエラーを表示状態に返すこと', async () => {
    // Arrange
    const problem: Problem = {
      code: 'loan_not_allowed',
      detail: 'この蔵書は貸出中です。',
      status: 409,
      title: '貸し出せません',
      type: 'https://library.example/problems/business-rule-violation',
    };
    const options = { fetch: fakeFetch(409, problem, 'application/problem+json') };

    // Act
    const view = await submitLoanCheckout?.(
      { patronNumber: 'P-2026-00002', copyId: '22222222-2222-4222-8222-222222222222' },
      options,
    );

    // Assert
    expect(view).toEqual({
      kind: 'error',
      title: '貸し出せません',
      detail: 'この蔵書は貸出中です。',
    });
  });
});
