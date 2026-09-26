/**
 * 貸出受付画面 (司書): 利用者と書籍を確かめて貸出を登録する (貸出の 3 手目)。
 * 構造の正は packages/ui/stories/LoanRegister.stories.tsx (Default / Completed / Error)。
 * 貸出日・返却期限は backend が決める値 (応答の loan.loanedOn / loan.dueDate) を表示するだけで、画面では算出しない。
 * 登録前はどちらも値が決まっていないため空欄にする (story Default との乖離は issues で変更要求中)。
 */
import { Alert, BookStatusBadge, Button, Card, PageHeader, PiiMaskedText } from '@repo/ui';
import type { BookStatus as BookStatusLabel } from '@repo/ui';
import { useState } from 'react';
import type { BookStatus } from '../../../../../packages/contracts/library-api/types';
import {
  type LoanCheckoutInput,
  type LoanCheckoutView,
  newIdempotencyKey,
  nextIdempotencyKey,
  type SubmitLoanCheckoutOptions,
  submitLoanCheckout,
} from '../../screens/loan-checkout/submit-loan-checkout';

/** 契約 BookStatus の説明 (available=在庫あり、on_loan=貸出中、awaiting_pickup=予約待ち) による表示名 */
export const bookStatusLabel: Record<BookStatus, BookStatusLabel> = {
  available: '在庫あり',
  on_loan: '貸出中',
  awaiting_pickup: '予約待ち',
};

/** 通信自体が失敗したときの文言 */
export const UNREACHABLE_MESSAGE =
  '通信できなかったため、貸出を登録できませんでした。通信状態を確かめて、もう一度お試しください。';

export interface LoanRegisterPatron {
  patronNumber: string;
  name: string;
}

export interface LoanRegisterBook {
  bookId: string;
  title: string;
  status: BookStatus;
}

export type LoanRegisterPhase = { kind: 'default' } | { kind: 'submitting' } | LoanCheckoutView;

export interface LoanRegisterViewProps {
  patron: LoanRegisterPatron;
  book: LoanRegisterBook;
  phase: LoanRegisterPhase;
  onSubmit?: () => void;
  onBack?: () => void;
  onContinue?: () => void;
}

/** 描画だけを担う。状態と操作は props で受け取る */
export function LoanRegisterView({
  patron,
  book,
  phase,
  onSubmit,
  onBack,
  onContinue,
}: LoanRegisterViewProps) {
  const completed = phase.kind === 'registered';
  const bookStatus = completed ? phase.bookStatus : book.status;
  return (
    <>
      <PageHeader
        title="貸出受付: 貸出の登録"
        description="手順 3 / 3 — 内容を確かめて登録します"
        breadcrumbs={[{ label: '貸出・返却' }, { label: '貸出受付' }]}
      />
      <div
        className="mx-auto flex w-full flex-col"
        style={{ maxWidth: 'var(--form-max-width)', gap: 'var(--component-gap)' }}
      >
        {phase.kind === 'registered' ? (
          <Alert variant="success" title="貸出を登録しました">
            返却期限は {phase.dueDate} です。利用者にお伝えください。
          </Alert>
        ) : null}
        {phase.kind === 'rejected' || phase.kind === 'failed' ? (
          <Alert variant="destructive" title="貸出を登録できませんでした">
            {phase.message}
          </Alert>
        ) : null}
        <Card
          title="貸出の内容"
          footer={
            completed ? (
              <Button variant="outline" icon="loan" onClick={onContinue}>
                続けて貸出を受け付ける
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={onBack}>
                  戻る
                </Button>
                <Button
                  variant="secondary"
                  icon="loan"
                  loading={phase.kind === 'submitting'}
                  onClick={onSubmit}
                >
                  貸出を登録する
                </Button>
              </>
            )
          }
        >
          <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">利用者</dt>
            <dd>
              <span className="font-mono">{patron.patronNumber}</span>{' '}
              <PiiMaskedText kind="name" value={patron.name} />
            </dd>
            <dt className="text-muted-foreground">書籍</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{book.title}</span>
              <BookStatusBadge status={bookStatusLabel[bookStatus]} />
            </dd>
            <dt className="text-muted-foreground">貸出日</dt>
            <dd>{completed ? phase.loanedOn : null}</dd>
            <dt className="text-muted-foreground">返却期限</dt>
            <dd className="font-semibold">
              {completed ? phase.dueDate : null}{' '}
              <span className="font-normal text-muted-foreground">
                (貸出日に貸出期間を加えた日。自動で決まります)
              </span>
            </dd>
          </dl>
        </Card>
      </div>
    </>
  );
}

export interface LoanRegisterScreenProps {
  patron: LoanRegisterPatron;
  book: LoanRegisterBook;
  /** API 呼び出しに使う fetch。UC BDD やテストが差し替える */
  fetchFn?: typeof fetch;
  /** API のベース URL・認可ヘッダ */
  apiOptions?: Omit<SubmitLoanCheckoutOptions, 'idempotencyKey'>;
  /** 入口関数の差し替え口 (既定は submitLoanCheckout) */
  submit?: (
    input: LoanCheckoutInput,
    fetchFn: typeof fetch | undefined,
    options: SubmitLoanCheckoutOptions,
  ) => Promise<LoanCheckoutView>;
  onBack?: () => void;
  onContinue?: () => void;
}

/** 状態を持つ画面。登録操作は入口関数 submitLoanCheckout に委ねる */
export function LoanRegisterScreen({
  patron,
  book,
  fetchFn,
  apiOptions,
  submit = submitLoanCheckout,
  onBack,
  onContinue,
}: LoanRegisterScreenProps) {
  const [phase, setPhase] = useState<LoanRegisterPhase>({ kind: 'default' });
  // 同じ画面での再送 (二度押し・再試行) は同じキーで送り、登録が重複しないようにする
  const [idempotencyKey, setIdempotencyKey] = useState<string>(newIdempotencyKey);

  const handleSubmit = async () => {
    if (phase.kind === 'submitting' || phase.kind === 'registered') return;
    setPhase({ kind: 'submitting' });
    try {
      const view = await submit(
        { patronNumber: patron.patronNumber, bookId: book.bookId },
        fetchFn,
        { ...apiOptions, idempotencyKey },
      );
      setPhase(view);
      setIdempotencyKey(nextIdempotencyKey(view, idempotencyKey));
    } catch {
      setPhase({ kind: 'failed', status: 0, message: UNREACHABLE_MESSAGE });
    }
  };

  const handleContinue = () => {
    setIdempotencyKey(newIdempotencyKey());
    setPhase({ kind: 'default' });
    onContinue?.();
  };

  return (
    <LoanRegisterView
      patron={patron}
      book={book}
      phase={phase}
      onSubmit={() => {
        void handleSubmit();
      }}
      onBack={onBack}
      onContinue={handleContinue}
    />
  );
}
