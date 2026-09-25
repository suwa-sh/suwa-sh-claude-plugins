/**
 * 貸出受付画面 (LoanCheckoutPage) の送信操作の単体テスト。
 * 二重送信の抑止 (ADR 0005) と、送信後のフォーム値の扱い (AssumptionRecord A-007) を確かめる。
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Loan, Problem } from '../../../../packages/contracts/api/types';
import { LoanCheckoutPage } from './LoanCheckoutPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

const conflict: Problem = {
  code: 'loan_not_allowed',
  detail: 'この蔵書は貸出中です。',
  status: 409,
  title: '貸し出せません',
  type: 'https://library.example/problems/business-rule-violation',
};

function jsonResponse(status: number, body: unknown, contentType: string): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': contentType } });
}

/** 呼ばれた回数を数え、応答を手動で返せる fetch。 */
function deferredFetch() {
  const pending: Array<(res: Response) => void> = [];
  const fetchFn = ((_input: RequestInfo | URL, _init?: RequestInit) =>
    new Promise<Response>((resolve) => {
      pending.push(resolve);
    })) as typeof fetch;
  return {
    fetch: fetchFn,
    get calls() {
      return pending.length;
    },
    respond: (index: number, res: Response) => pending[index]?.(res),
  };
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function input(name: string): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!el) throw new Error(`input ${name} が無い`);
  return el;
}

function fill(values: { patronNo: string; copyId: string }): void {
  input('patronNo').value = values.patronNo;
  input('copyId').value = values.copyId;
}

function submitEvent(): Event {
  return new Event('submit', { bubbles: true, cancelable: true });
}

function form(): HTMLFormElement {
  const el = container.querySelector('form');
  if (!el) throw new Error('form が無い');
  return el;
}

describe('貸出受付画面の送信', () => {
  it('再描画前に連続して送信した場合_APIを1回だけ呼ぶこと', async () => {
    // Arrange
    const api = deferredFetch();
    act(() => root.render(<LoanCheckoutPage api={{ fetch: api.fetch }} />));
    fill({ patronNo: 'P-2026-00001', copyId: loan.copy_id });

    // Act
    await act(async () => {
      form().dispatchEvent(submitEvent());
      form().dispatchEvent(submitEvent());
    });

    // Assert
    expect(api.calls).toBe(1);
  });

  it('応答を受け取った後に送信した場合_もう一度APIを呼べること', async () => {
    // Arrange
    const api = deferredFetch();
    act(() => root.render(<LoanCheckoutPage api={{ fetch: api.fetch }} />));
    fill({ patronNo: 'P-2026-00002', copyId: loan.copy_id });
    await act(async () => {
      form().dispatchEvent(submitEvent());
    });
    await act(async () => {
      api.respond(0, jsonResponse(409, conflict, 'application/problem+json'));
    });

    // Act
    await act(async () => {
      form().dispatchEvent(submitEvent());
    });

    // Assert
    expect(api.calls).toBe(2);
  });

  it('貸し出した場合_入力欄を空に戻すこと', async () => {
    // Arrange
    const api = deferredFetch();
    act(() => root.render(<LoanCheckoutPage api={{ fetch: api.fetch }} />));
    fill({ patronNo: 'P-2026-00001', copyId: loan.copy_id });
    await act(async () => {
      form().dispatchEvent(submitEvent());
    });

    // Act
    await act(async () => {
      api.respond(0, jsonResponse(201, loan, 'application/json'));
    });

    // Assert
    expect({ patronNo: input('patronNo').value, copyId: input('copyId').value }).toEqual({
      patronNo: '',
      copyId: '',
    });
  });

  it('貸し出せない場合_直前の入力を入力欄に残すこと', async () => {
    // Arrange
    const api = deferredFetch();
    act(() => root.render(<LoanCheckoutPage api={{ fetch: api.fetch }} />));
    fill({ patronNo: 'P-2026-00002', copyId: loan.copy_id });
    await act(async () => {
      form().dispatchEvent(submitEvent());
    });

    // Act
    await act(async () => {
      api.respond(0, jsonResponse(409, conflict, 'application/problem+json'));
    });

    // Assert
    expect({ patronNo: input('patronNo').value, copyId: input('copyId').value }).toEqual({
      patronNo: 'P-2026-00002',
      copyId: loan.copy_id,
    });
  });
});
