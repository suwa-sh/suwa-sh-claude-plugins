import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoanRecord } from "../../../components/domain/LoanRecord";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import { PageHeader, Panel, actionsStyle, pageContentStyle } from "../../shared/PageStoryParts";

type LoanReturnState = "default" | "empty" | "loading";

const loans = [
  { bookTitle: "吾輩は猫である", borrowerName: "田中太郎", loanDate: "2026-04-12", dueDate: "2026-04-26", returnDate: null, isOverdue: false },
  { bookTitle: "こころ", borrowerName: "田中太郎", loanDate: "2026-03-18", dueDate: "2026-04-01", returnDate: null, isOverdue: true },
];

function LoanReturnPage({ state }: { state: LoanReturnState }) {
  return (
    <UserPortalShell activePage="loans" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="返却手続き" description="貸出中の書籍を選んで返却処理を行います。" />
        {state === "loading" ? (
          <LoadingSkeleton variant="table-row" count={4} />
        ) : state === "empty" ? (
          <EmptyState message="現在貸出中の書籍はありません" actionLabel="蔵書を探す" />
        ) : (
          <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
            {loans.map((loan) => (
              <Panel key={loan.bookTitle}>
                <LoanRecord {...loan} />
                <div style={actionsStyle}><Button size="sm">返却する</Button></div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/LoanReturn",
  component: LoanReturnPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof LoanReturnPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
