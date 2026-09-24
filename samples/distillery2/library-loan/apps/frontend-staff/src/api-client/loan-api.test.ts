import { describe, expect, it } from 'vitest';
import created201 from '../../../../packages/contracts/api/stubs/createLoan.201.json';
import conflict409 from '../../../../packages/contracts/api/stubs/createLoan.409.json';
import { CREATE_LOAN_PATH, createLoanApi, type ApiRequest, type ApiResponse } from './loan-api';

function fakeTransport(response: ApiResponse) {
  const requests: ApiRequest[] = [];
  const transport = async (request: ApiRequest): Promise<ApiResponse> => {
    requests.push(request);
    return response;
  };
  return { transport, requests };
}

const request = { patronNumber: 'P000123', bookId: '11111111-1111-4111-8111-111111111111' };

describe('貸出 API クライアント createLoan', () => {
  it('createLoan_呼び出した場合_契約のパスへ入力をそのまま POST すること', async () => {
    // Arrange
    const { transport, requests } = fakeTransport({ status: 201, body: created201 });
    const api = createLoanApi(transport);

    // Act
    await api.createLoan(request);

    // Assert
    expect(requests).toEqual([{ method: 'POST', path: CREATE_LOAN_PATH, body: request }]);
  });

  it('createLoan_201が返った場合_登録された貸出を返すこと', async () => {
    // Arrange
    const { transport } = fakeTransport({ status: 201, body: created201 });
    const api = createLoanApi(transport);

    // Act
    const result = await api.createLoan(request);

    // Assert
    expect(result).toEqual({ kind: 'created', status: 201, loan: created201 });
  });

  it('createLoan_409のProblemが返った場合_Problemをそのまま返すこと', async () => {
    // Arrange
    const { transport } = fakeTransport({ status: 409, body: conflict409 });
    const api = createLoanApi(transport);

    // Act
    const result = await api.createLoan(request);

    // Assert
    expect(result).toEqual({ kind: 'problem', status: 409, problem: conflict409 });
  });

  it('createLoan_本文がProblemでない失敗応答の場合_problemをnullで返すこと', async () => {
    // Arrange
    const { transport } = fakeTransport({ status: 502, body: '<html>Bad Gateway</html>' });
    const api = createLoanApi(transport);

    // Act
    const result = await api.createLoan(request);

    // Assert
    expect(result).toEqual({ kind: 'problem', status: 502, problem: null });
  });

  it('createLoan_通信に失敗した場合_network-errorを返すこと', async () => {
    // Arrange
    const api = createLoanApi(async () => {
      throw new TypeError('Failed to fetch');
    });

    // Act
    const result = await api.createLoan(request);

    // Assert
    expect(result).toEqual({ kind: 'network-error' });
  });
});
