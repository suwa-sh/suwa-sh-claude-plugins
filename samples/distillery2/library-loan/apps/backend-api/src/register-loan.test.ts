/**
 * register-loan.test.ts — UC「貸出を登録する」の red baseline (d2-implement mode=scaffold)
 *
 * 中心の振る舞い: 条件「返却期限算出」(貸出日 + 貸出期間) と 条件「貸出可否」。
 * 実装は mode=tier が書く。ティアのエントリ (./index) から次の名前で公開する想定:
 *   - calculateDueOn(loanedOn: 'YYYY-MM-DD', loanPeriodDays: number): 'YYYY-MM-DD'
 *   - judgeLoanEligibility(copy: { status: CopyStatus; heldForPatronNumber: string | null }, patronNumber: string)
 *       : { allowed: true } | { allowed: false; reason: string }
 * 未実装のあいだは export が無く、assert が落ちる (import 失敗では落とさない)。
 */
import { describe, expect, it } from 'vitest';
import * as backend from './index';

type CopyStatus = 'available' | 'on_loan' | 'on_hold' | 'withdrawn';
type Eligibility = { allowed: true } | { allowed: false; reason: string };

const exported = backend as Record<string, unknown>;
const calculateDueOn = exported.calculateDueOn as
  | ((loanedOn: string, loanPeriodDays: number) => string)
  | undefined;
const judgeLoanEligibility = exported.judgeLoanEligibility as
  | ((
      copy: { status: CopyStatus; heldForPatronNumber: string | null },
      patronNumber: string,
    ) => Eligibility)
  | undefined;

describe('返却期限算出', () => {
  it('calculateDueOn_貸出日が2026-09-01で貸出期間が14日の場合_返却期限が2026-09-15であること', () => {
    // Arrange
    const loanedOn = '2026-09-01';
    const loanPeriodDays = 14;

    // Act
    const dueOn = calculateDueOn?.(loanedOn, loanPeriodDays);

    // Assert
    expect(dueOn).toBe('2026-09-15');
  });

  it('calculateDueOn_貸出日が2026-09-20で貸出期間が14日の場合_月をまたいだ2026-10-04が返却期限であること', () => {
    // Arrange
    const loanedOn = '2026-09-20';
    const loanPeriodDays = 14;

    // Act
    const dueOn = calculateDueOn?.(loanedOn, loanPeriodDays);

    // Assert
    expect(dueOn).toBe('2026-10-04');
  });
});

describe('貸出可否', () => {
  it('judgeLoanEligibility_蔵書が在庫ありの場合_貸し出せること', () => {
    // Arrange
    const copy = { status: 'available' as const, heldForPatronNumber: null };

    // Act
    const result = judgeLoanEligibility?.(copy, 'P-2026-00001');

    // Assert
    expect(result).toEqual({ allowed: true });
  });

  it('judgeLoanEligibility_蔵書が貸出中の場合_貸し出せないこと', () => {
    // Arrange
    const copy = { status: 'on_loan' as const, heldForPatronNumber: null };

    // Act
    const result = judgeLoanEligibility?.(copy, 'P-2026-00002');

    // Assert
    expect(result).toMatchObject({ allowed: false });
  });

  it('judgeLoanEligibility_蔵書が他の利用者向けに取り置き中の場合_貸し出せないこと', () => {
    // Arrange
    const copy = { status: 'on_hold' as const, heldForPatronNumber: 'P-2026-00001' };

    // Act
    const result = judgeLoanEligibility?.(copy, 'P-2026-00002');

    // Assert
    expect(result).toMatchObject({ allowed: false });
  });

  it('judgeLoanEligibility_蔵書が本人向けに取り置き中の場合_貸し出せること', () => {
    // Arrange
    const copy = { status: 'on_hold' as const, heldForPatronNumber: 'P-2026-00001' };

    // Act
    const result = judgeLoanEligibility?.(copy, 'P-2026-00001');

    // Assert
    expect(result).toEqual({ allowed: true });
  });
});
