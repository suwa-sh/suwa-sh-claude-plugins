// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md
//   「画面仕様(貸出手続き画面)」「コンポーネント設計(LoanConfirmation)」
//
// packages/ui の BookCard(detailed) / Button と、既存の値変換ロジック(src/components/loanConfirmation.ts)を
// 組み合わせて実際に DOM を描画する画面コンポーネント。attempt-1 の findings F-001(blocker)の是正対象。
//
// packages/ui/stories/Pages/UserPortal/LoanCheckout.stories.tsx を土台にしており、BookLoanStatusBadge は
// BookCard が内部で描画するため(BookCard.tsx 参照)、ここでは個別に import しない(Story と同じ構成)。
import * as React from "react";
import type { BookResponse } from "../../../packages/contracts/api-client/models/BookResponse";
import type { LoanResponse } from "../../../packages/contracts/api-client/models/LoanResponse";
import { BookCard } from "../../../packages/ui/components/domain/BookCard";
import { Button } from "../../../packages/ui/components/ui/Button";
import {
  calculateExpectedDueDate,
  formatCompletionMessage,
  formatDateSlash,
  isLoanButtonEnabled,
  mapLoanErrorMessage,
  toBookCardProps,
  toLoanConfirmationBook,
  type LoanConfirmationBook,
} from "./loanConfirmation";

/**
 * 出典: tier-frontend.md コンポーネント設計「LoanConfirmation」Props 表。
 * 「onLoan: () => Promise<void>」と定義されているが、状態「loanResult (LoanResponse)」を
 * コンポーネント自身が保持するには貸出結果(返却期限を含む)を受け取る必要があるため、
 * onLoan の戻り値は Promise<LoanResponse> として実装する(表記上の簡略化と判断)。
 * 疑義は docs/impl/latest/19ec0182/issues/ に起票済み。
 */
export interface LoanConfirmationProps {
  book: BookResponse;
  onLoan: () => Promise<LoanResponse>;
  isLoading?: boolean;
}

/** LoanConfirmation の描画に必要な状態(コンポーネント外からも直接レンダリングして DOM を検証できるよう分離) */
export interface LoanConfirmationViewState {
  book: LoanConfirmationBook;
  /** 予定返却期限の算出基準日。テスト容易性のため呼び出し側から渡す */
  today: Date;
  isCompleted: boolean;
  loanResult: LoanResponse | null;
  errorMessage: string | null;
  /** Props.isLoading(外部から渡される処理中フラグ)と内部の送信中フラグの合成値 */
  isSubmitting: boolean;
}

export interface LoanConfirmationHandlers {
  onLoanClick: () => void;
  onBackClick: () => void;
}

/**
 * 貸出手続き画面の純粋な描画関数。状態を明示的な引数として受け取るため、
 * react-dom/server の renderToStaticMarkup で各状態(初期表示/完了後/エラー時)の
 * DOM 出力をそのままテストできる(jsdom 不要)。
 */
export function renderLoanConfirmationView(
  viewState: LoanConfirmationViewState,
  handlers: LoanConfirmationHandlers,
): React.ReactElement {
  const cardProps = toBookCardProps(viewState.book);
  // 出典: tier-frontend.md UIロジック「バリデーション: 書籍の status が "available" でない場合は貸出ボタンを disabled」
  // isSubmitting には Props.isLoading と内部の送信中フラグが合成済み(LoanConfirmation 参照)
  const loanButtonEnabled =
    isLoanButtonEnabled(viewState.book) && !viewState.isSubmitting;
  // 出典: tier-frontend.md 操作フロー「2. 書籍情報と予定返却期限(今日 + 14日)が表示される」
  const expectedDueDate = formatDateSlash(
    calculateExpectedDueDate(viewState.today),
  );

  return (
    <section aria-label="貸出手続き">
      {/* 表示要素: 書籍情報カード(BookCard detailed)。BookLoanStatusBadge は BookCard 内部で描画される */}
      <BookCard {...cardProps} />

      {!viewState.isCompleted && (
        // 表示要素: 返却期限表示(テキスト)「返却期限: YYYY/MM/DD」
        <p>返却期限: {expectedDueDate}</p>
      )}

      {viewState.errorMessage != null && (
        // UIロジック: エラーハンドリング「409 の場合...エラーバナー」
        <p role="alert">{viewState.errorMessage}</p>
      )}

      {viewState.isCompleted && viewState.loanResult != null && (
        // ティア完了条件(BDD) Scenario「貸出完了後の表示」の表示文言
        <output>{formatCompletionMessage(viewState.loanResult)}</output>
      )}

      <Button
        type="button"
        variant="default"
        size="lg"
        disabled={!loanButtonEnabled}
        onClick={handlers.onLoanClick}
      >
        {viewState.isSubmitting ? "処理中..." : "貸出する"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={handlers.onBackClick}
      >
        戻る
      </Button>
    </section>
  );
}

/**
 * 出典: tier-frontend.md コンポーネント設計「LoanConfirmation」
 * Props: book(BookResponse) / onLoan(貸出実行ハンドラ) / isLoading(処理中フラグ)
 * 状態: isCompleted, loanResult(LoanResponse)
 */
export const LoanConfirmation: React.FC<LoanConfirmationProps> = ({
  book,
  onLoan,
  isLoading = false,
}) => {
  const [isCompleted, setIsCompleted] = React.useState(false);
  const [loanResult, setLoanResult] = React.useState<LoanResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const viewBook = toLoanConfirmationBook(book);

  const handleLoanClick = (): void => {
    setErrorMessage(null);
    setIsSubmitting(true);
    onLoan().then(
      (result) => {
        setLoanResult(result);
        setIsCompleted(true);
        setIsSubmitting(false);
      },
      (error) => {
        // UIロジック: エラーハンドリング「409 の場合「この書籍は現在貸出できません」エラーバナー」
        setErrorMessage(mapLoanErrorMessage(error));
        setIsSubmitting(false);
      },
    );
  };

  const handleBackClick = (): void => {
    // 表示要素「戻るボタン: 検索画面に戻る」。アプリシェル/ルーターが未生成のため(issues/ 参照)、
    // 暫定的に履歴を戻る実装とする。ルーター統合時に置き換える想定。
    if (typeof window !== "undefined" && window.history) {
      window.history.back();
    }
  };

  return renderLoanConfirmationView(
    {
      book: viewBook,
      today: new Date(),
      isCompleted,
      loanResult,
      errorMessage,
      // Props.isLoading(外部由来の処理中フラグ)と onLoan 実行中フラグを合成する
      isSubmitting: isLoading || isSubmitting,
    },
    { onLoanClick: handleLoanClick, onBackClick: handleBackClick },
  );
};
