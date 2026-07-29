// 出典: docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する/tier-frontend.md
//   「画面仕様(貸出手続き画面)」URL: /loans/new?book_id={book_id}
//
// LoanConfirmation(コンポーネント設計どおりの実描画コンポーネント)を、URL の book_id をもとに
// 書籍情報を取得してマウントするルート層。
//
// 注意: このリポジトリにはまだアプリシェル/ルーター(react-router 等)が生成されていないため、
// 実際に "/loans/new" というパスへルーティングする配線(<Route path="/loans/new" .../> 等)は
// 存在しない。本コンポーネントは book_id を渡されればいつでもマウント可能な形で実装しており、
// アプリシェル bootstrap 時にそのまま組み込める。詳細は issues/ に起票済み。
import * as React from "react";
import type { BookResponse } from "../../../packages/contracts/api-client/models/BookResponse";
import type { LoanResponse } from "../../../packages/contracts/api-client/models/LoanResponse";
import { LoanConfirmation } from "../components/LoanConfirmationScreen";
import type { LoanConfirmationController } from "../components/loanConfirmation";
import { mapLoanErrorMessage } from "../components/loanConfirmation";

export interface LoanConfirmationPageProps {
  bookId: string;
  controller: LoanConfirmationController;
}

/** ページの読み込み状態。書籍情報取得(GET /api/v1/books/:id)の非同期状態を表す */
export type LoanConfirmationPageViewState =
  | { kind: "loading" }
  | { kind: "loaded"; book: BookResponse }
  | { kind: "error"; message: string };

/**
 * 出典: tier-frontend.md UIロジック「ローディング: 書籍情報取得時は Skeleton UI」。
 * packages/ui に Skeleton コンポーネントが未生成のため(packages/ui/.imported.yaml 参照。
 * design 側の生成未完了として記録済み)、自作コンポーネントを追加せず(coding-rules.md rule 2)、
 * LoanCheckout.stories.tsx の Error/Completed 表現(素の <p> 要素)と同じ水準の
 * テキストによる代替表示にとどめる。詳細は issues/ に起票済み。
 */
export function renderLoanConfirmationPageBody(
  viewState: LoanConfirmationPageViewState,
  submitLoan: (bookId: string) => Promise<LoanResponse>,
): React.ReactElement {
  if (viewState.kind === "loading") {
    return <output>読み込み中...</output>;
  }
  if (viewState.kind === "error") {
    return <p role="alert">{viewState.message}</p>;
  }
  return (
    <LoanConfirmation
      book={viewState.book}
      onLoan={() => submitLoan(viewState.book.id)}
    />
  );
}

/** 貸出申請ごとに新規発行する冪等キー。出典: coding-rules.md / loanConfirmation.ts submitLoan の xIdempotencyKey */
function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

export const LoanConfirmationPage: React.FC<LoanConfirmationPageProps> = ({
  bookId,
  controller,
}) => {
  const [viewState, setViewState] =
    React.useState<LoanConfirmationPageViewState>({
      kind: "loading",
    });

  React.useEffect(() => {
    let cancelled = false;
    controller.loadBookResponse(bookId).then(
      (book) => {
        if (!cancelled) {
          setViewState({ kind: "loaded", book });
        }
      },
      (error) => {
        if (!cancelled) {
          setViewState({ kind: "error", message: mapLoanErrorMessage(error) });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [bookId, controller]);

  return renderLoanConfirmationPageBody(viewState, (id) =>
    controller.submitLoan(id, createIdempotencyKey()),
  );
};

/** URL の /loans/new?book_id={book_id} から book_id を取り出す純粋関数(出典: tier-frontend.md 画面仕様 URL) */
export function readBookIdFromLocation(search: string): string | null {
  return new URLSearchParams(search).get("book_id");
}
