/**
 * 貸出受付画面 (view 層)。構造の正は packages/ui/stories/LoanCheckout.stories.tsx。
 * データは state 層 (submitLoanCheckout) から得て、api-client を直接呼ばない。
 */
import { useRef, useState } from 'react';
import { DueDateText } from '../../../../packages/ui/components/domain/DueDateText';
import {
  LoanCheckoutForm,
  type LoanCheckoutValues,
} from '../../../../packages/ui/components/domain/LoanCheckoutForm';
import { LoanStatusBadge } from '../../../../packages/ui/components/domain/LoanStatusBadge';
import { AppShell } from '../../../../packages/ui/components/layout/AppShell';
import { PageHeader } from '../../../../packages/ui/components/layout/PageHeader';
import { Alert } from '../../../../packages/ui/components/ui/Alert';
import { Card } from '../../../../packages/ui/components/ui/Card';
import { type ApiOptions, type LoanCheckoutView, submitLoanCheckout } from '../state/loan-checkout';

/** 画面のルート (docs/design/screens.yaml の LoanCheckout)。 */
export const LOAN_CHECKOUT_ROUTE = '/admin/loans/new';

export interface LoanCheckoutScreenProps {
  /** 直前の送信結果。未送信なら undefined */
  view?: LoanCheckoutView;
  /** 送信中 (二重送信の抑止に使う) */
  submitting?: boolean;
  /** 直前に送信した入力 (エラー時にフォームへ戻す) */
  lastValues?: LoanCheckoutValues;
  userName?: string;
  onSubmit?: (values: LoanCheckoutValues) => void;
}

/** 表示だけを担う貸出受付画面。状態は props で受け取る。 */
export function LoanCheckoutScreen({
  view,
  submitting = false,
  lastValues,
  userName,
  onSubmit,
}: LoanCheckoutScreenProps) {
  const isError = view?.kind === 'error';
  return (
    <AppShell portal="admin" currentPath={LOAN_CHECKOUT_ROUTE} userName={userName}>
      <PageHeader
        title="貸出受付"
        icon="loan-out"
        description="利用者番号と蔵書IDを入力して貸し出します"
      />
      <div className="grid grid-cols-12">
        <div className="col-span-12 flex flex-col gap-[var(--section-gap)] lg:col-span-8 lg:col-start-3">
          {view?.kind === 'success' && (
            <Alert variant="success" title="貸し出しました">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span>
                  {view.loan.book_title} ({view.loan.copy_id})
                </span>
                <LoanStatusBadge status={view.loan.status} />
                <span>返却期限</span>
                <DueDateText dueOn={view.loan.due_on} status={view.loan.status} />
              </div>
            </Alert>
          )}
          {view?.kind === 'error' && (
            <Alert variant="destructive" title={view.title}>
              {view.detail}
            </Alert>
          )}
          <Card>
            <LoanCheckoutForm
              key={view?.kind === 'success' ? view.loan.loan_id : 'form'}
              defaultValues={isError ? lastValues : undefined}
              errors={isError ? view.fieldErrors : undefined}
              submitting={submitting}
              onSubmit={onSubmit}
            />
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export interface LoanCheckoutPageProps {
  /** API 呼び出しの設定 (fetch・認可ヘッダ)。上位から注入する */
  api?: ApiOptions;
  userName?: string;
}

/**
 * 貸出受付画面。送信中は再送信を受け付けない (ADR 0005)。
 * 送信中の判定は ref で持ち、再描画 (ボタンの disabled 反映) より前の連続送信も抑止する。
 */
export function LoanCheckoutPage({ api, userName }: LoanCheckoutPageProps) {
  const [view, setView] = useState<LoanCheckoutView | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [lastValues, setLastValues] = useState<LoanCheckoutValues | undefined>(undefined);
  const inFlight = useRef(false);

  const handleSubmit = async (values: LoanCheckoutValues) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setLastValues(values);
    try {
      setView(
        await submitLoanCheckout({ patronNumber: values.patronNo, copyId: values.copyId }, api),
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <LoanCheckoutScreen
      view={view}
      submitting={submitting}
      lastValues={lastValues}
      userName={userName}
      onSubmit={(values) => {
        void handleSubmit(values);
      }}
    />
  );
}
