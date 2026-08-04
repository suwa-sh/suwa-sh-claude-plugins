import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/common/ErrorBanner";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import {
  Notice,
  PageHeader,
  Panel,
  actionsStyle,
  pageContentStyle,
  sampleBooks,
} from "../../shared/PageStoryParts";

type LoanCheckoutState = "default" | "completed" | "error" | "loading";

function LoanCheckoutPage({ state }: { state: LoanCheckoutState }) {
  return (
    <UserPortalShell activePage="loans" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="貸出手続き" description="書籍情報と返却期限を確認して貸出を確定します。" />
        {state === "error" && (
          <ErrorBanner
            error={{ title: "貸出できません", status: 409, detail: "この書籍は現在貸出できません。" }}
          />
        )}
        {state === "completed" && (
          <Notice tone="success" title="貸出が完了しました">
            返却期限は 2026年4月26日です。期限までに返却手続きをお願いします。
          </Notice>
        )}
        {state === "loading" ? (
          <LoadingSkeleton variant="card" count={1} />
        ) : (
          <BookCard {...sampleBooks.cat} variant="detailed" />
        )}
        <Panel title="貸出条件" description="貸出期間は手続き日から14日間です。">
          <dl style={{ display: "grid", gap: "var(--spacing-3)", margin: 0 }}>
            <div><dt style={{ color: "var(--muted-foreground)" }}>貸出日</dt><dd style={{ color: "var(--foreground)", margin: 0 }}>2026年4月12日</dd></div>
            <div><dt style={{ color: "var(--muted-foreground)" }}>返却期限</dt><dd style={{ color: "var(--foreground)", fontWeight: "var(--font-weight-bold)", margin: 0 }}>2026年4月26日</dd></div>
          </dl>
          <div style={actionsStyle}>
            <Button size="lg" disabled={state === "loading" || state === "completed"}>貸出する</Button>
            <Button variant="outline">蔵書検索へ戻る</Button>
          </div>
        </Panel>
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/LoanCheckout",
  component: LoanCheckoutPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof LoanCheckoutPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Completed: Story = { args: { state: "completed" } };
export const Error: Story = { args: { state: "error" } };
export const Loading: Story = { args: { state: "loading" } };
