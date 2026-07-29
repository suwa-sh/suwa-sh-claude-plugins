import * as React from "react";
import { BookCard } from "../../../components/domain/BookCard";
import { Button } from "../../../components/ui/Button";
import { colors, spacing, fontSize } from "../../../tokens/tokens";

/**
 * 貸出手続き画面(route: /loans/new, uc: 書籍を貸出する)
 * variants: Default / Completed / Error / Loading
 */
type LoanCheckoutState = "default" | "completed" | "error" | "loading";

const sampleBook = {
  title: "リーダブルコード",
  author: "Dustin Boswell",
  isbn: "978-4873115658",
  publisher: "オライリージャパン",
  genre: "技術書",
  materialType: "書籍",
  location: "3F 技術書コーナー",
  status: "available" as const,
};

const LoanCheckoutPage: React.FC<{ state: LoanCheckoutState }> = ({ state }) => (
  <main style={{ background: colors.background, padding: spacing.lg, display: "grid", gap: spacing.md }}>
    <h1 style={{ fontSize: fontSize.xl, color: colors.textPrimary }}>貸出手続き</h1>
    <BookCard {...sampleBook} variant="detailed" />
    {state === "error" && (
      <p role="alert" style={{ color: colors.destructive }}>
        貸出上限に達しているため貸出できません。
      </p>
    )}
    {state === "completed" && (
      <p role="status" style={{ color: colors.success }}>
        貸出手続きが完了しました。返却期限を確認してください。
      </p>
    )}
    <Button disabled={state === "loading"}>
      {state === "loading" ? "処理中..." : "貸出を確定する"}
    </Button>
  </main>
);

export default {
  title: "Pages/UserPortal/LoanCheckout",
  component: LoanCheckoutPage,
};

export const Default = () => <LoanCheckoutPage state="default" />;
export const Completed = () => <LoanCheckoutPage state="completed" />;
export const Error = () => <LoanCheckoutPage state="error" />;
export const Loading = () => <LoanCheckoutPage state="loading" />;
