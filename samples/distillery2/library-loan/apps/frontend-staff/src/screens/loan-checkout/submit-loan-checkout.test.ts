import { describe, expect, it } from 'vitest';
import created201 from '../../../../../packages/contracts/api/stubs/createLoan.201.json';
import type { LoanApi } from '../../api-client/loan-api';
import type { CreateLoanRequest, Loan } from '../../api-client/loan-api-types';
import { submitLoanCheckout } from './submit-loan-checkout';

function recordingApi(): { api: LoanApi; requests: CreateLoanRequest[] } {
  const requests: CreateLoanRequest[] = [];
  const api: LoanApi = {
    async createLoan(request) {
      requests.push(request);
      return { kind: 'created', status: 201, loan: created201 as Loan };
    },
  };
  return { api, requests };
}

describe('貸出受付画面の貸出する操作 submitLoanCheckout', () => {
  it('submitLoanCheckout_読み取り値に前後の空白がある場合_空白を除いて貸出登録を送ること', async () => {
    // Arrange
    const { api, requests } = recordingApi();

    // Act
    await submitLoanCheckout(api, { patronNumber: ' P000123\n', bookId: '\t11111111-1111-4111-8111-111111111111 ' });

    // Assert
    expect(requests).toEqual([{ patronNumber: 'P000123', bookId: '11111111-1111-4111-8111-111111111111' }]);
  });

  it('submitLoanCheckout_貸出が登録された場合_completedの画面状態を返すこと', async () => {
    // Arrange
    const { api } = recordingApi();

    // Act
    const view = await submitLoanCheckout(api, { patronNumber: 'P000123', bookId: '11111111-1111-4111-8111-111111111111' });

    // Assert
    expect(view.variant).toBe('completed');
    expect(view.loan?.dueOn).toBe((created201 as Loan).dueOn);
  });
});
