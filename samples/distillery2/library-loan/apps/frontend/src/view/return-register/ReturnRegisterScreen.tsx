/**
 * 返却受付画面 (司書): 返却された書籍の書籍IDを入力して返却を登録する。
 * 構造の正は packages/ui/stories/ReturnRegister.stories.tsx (Default / ReturnedAvailable / ReturnedOnHold / Error)。
 * 返却後の書籍状態は backend が決める値 (応答の bookStatus) を表示するだけで、画面では決めない。
 * story との乖離 (Default の「この書籍の貸出」の表と、結果の書籍名) は issues で変更要求中。
 */
import { Alert, BookStatusBadge, Button, Card, Input, PageHeader } from '@repo/ui';
import { type FormEvent, useState } from 'react';
import {
  type ReturnCheckoutInput,
  type ReturnCheckoutView,
  type SubmitReturnCheckoutOptions,
  submitReturnCheckout,
} from '../../screens/return-checkout/submit-return-checkout';
import { newIdempotencyKey, nextIdempotencyKey } from '../../screens/shared/idempotency-key';
import { bookStatusLabel } from '../loan-register/LoanRegisterScreen';

/** 通信自体が失敗したときの文言 */
export const RETURN_UNREACHABLE_MESSAGE =
  '通信できなかったため、返却を登録できませんでした。通信状態を確かめて、もう一度お試しください。';

/** 予約待ちになったときの案内 (story ReturnedOnHold の文言) */
const ON_HOLD_NOTE = 'になりました。予約 1 番目の利用者に返却のお知らせメールを送ります。';

export type ReturnRegisterPhase =
  | { kind: 'default' }
  | { kind: 'submitting' }
  | (ReturnCheckoutView & { bookId: string });

export interface ReturnRegisterViewProps {
  /** 入力中の書籍ID */
  bookId: string;
  phase: ReturnRegisterPhase;
  onBookIdChange?: (bookId: string) => void;
  onSubmit?: () => void;
}

/** 描画だけを担う。状態と操作は props で受け取る */
export function ReturnRegisterView({
  bookId,
  phase,
  onBookIdChange,
  onSubmit,
}: ReturnRegisterViewProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.();
  };
  return (
    <>
      <PageHeader
        title="返却受付"
        description="返却された書籍の書籍IDを入力します"
        breadcrumbs={[{ label: '貸出・返却' }, { label: '返却受付' }]}
      />
      <div
        className="mx-auto flex w-full flex-col"
        style={{ maxWidth: 'var(--content-max-width)', gap: 'var(--component-gap)' }}
      >
        <Card>
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleSubmit}>
            <Input
              label="書籍ID"
              value={bookId}
              onChange={(e) => onBookIdChange?.(e.target.value)}
              className="min-w-48 flex-1"
            />
            <Button
              type="submit"
              variant="secondary"
              icon="return"
              loading={phase.kind === 'submitting'}
            >
              返却を登録する
            </Button>
          </form>
        </Card>
        {phase.kind === 'returned' && phase.bookStatus !== 'awaiting_pickup' ? (
          <Alert variant="success" title="返却を登録しました">
            <span className="inline-flex flex-wrap items-center gap-2">
              書籍ID {phase.bookId} の書籍は{' '}
              <BookStatusBadge status={bookStatusLabel[phase.bookStatus]} /> になりました。
            </span>
          </Alert>
        ) : null}
        {phase.kind === 'returned' && phase.bookStatus === 'awaiting_pickup' ? (
          <Alert variant="warning" title="予約のある書籍です。取り置いてください">
            <span className="inline-flex flex-wrap items-center gap-2">
              書籍ID {phase.bookId} の書籍は{' '}
              <BookStatusBadge status={bookStatusLabel[phase.bookStatus]} /> {ON_HOLD_NOTE}
            </span>
          </Alert>
        ) : null}
        {phase.kind === 'rejected' || phase.kind === 'failed' ? (
          <Alert variant="destructive" title="返却を登録できませんでした">
            {phase.message}
          </Alert>
        ) : null}
      </div>
    </>
  );
}

export interface ReturnRegisterScreenProps {
  /** API 呼び出しに使う fetch。UC BDD やテストが差し替える */
  fetchFn?: typeof fetch;
  /** API のベース URL・認可ヘッダ */
  apiOptions?: Omit<SubmitReturnCheckoutOptions, 'idempotencyKey'>;
  /** 入口関数の差し替え口 (既定は submitReturnCheckout) */
  submit?: (
    input: ReturnCheckoutInput,
    fetchFn: typeof fetch | undefined,
    options: SubmitReturnCheckoutOptions,
  ) => Promise<ReturnCheckoutView>;
}

/** 状態を持つ画面。登録操作は入口関数 submitReturnCheckout に委ねる */
export function ReturnRegisterScreen({
  fetchFn,
  apiOptions,
  submit = submitReturnCheckout,
}: ReturnRegisterScreenProps) {
  const [bookId, setBookId] = useState('');
  const [phase, setPhase] = useState<ReturnRegisterPhase>({ kind: 'default' });
  // 同じ書籍IDの再送 (二度押し・再試行) は同じキーで送り、返却が重複しないようにする
  const [idempotencyKey, setIdempotencyKey] = useState<string>(newIdempotencyKey);

  const handleBookIdChange = (next: string) => {
    // 書籍IDが変われば別の返却操作なので、新しいキーにする
    if (next !== bookId) setIdempotencyKey(newIdempotencyKey());
    setBookId(next);
  };

  const handleSubmit = async () => {
    if (phase.kind === 'submitting') return;
    const target = bookId;
    setPhase({ kind: 'submitting' });
    try {
      const view = await submit({ bookId: target }, fetchFn, { ...apiOptions, idempotencyKey });
      setPhase({ ...view, bookId: target });
      setIdempotencyKey(nextIdempotencyKey(view, idempotencyKey));
    } catch {
      setPhase({ kind: 'failed', status: 0, message: RETURN_UNREACHABLE_MESSAGE, bookId: target });
    }
  };

  return (
    <ReturnRegisterView
      bookId={bookId}
      phase={phase}
      onBookIdChange={handleBookIdChange}
      onSubmit={() => {
        void handleSubmit();
      }}
    />
  );
}
