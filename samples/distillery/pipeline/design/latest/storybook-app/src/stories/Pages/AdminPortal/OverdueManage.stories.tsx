import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookLoanStatusBadge } from "../../../components/domain/BookLoanStatusBadge";
import { LoanRecord } from "../../../components/domain/LoanRecord";
import { Button } from "../../../components/ui/Button";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { Notice, PageHeader, Panel, actionsStyle, pageContentStyle } from "../../shared/PageStoryParts";

type OverdueState = "default" | "empty" | "loading";
const overdueLoans = [
  { bookTitle: "こころ", borrowerName: "佐藤美咲", loanDate: "2026-03-18", dueDate: "2026-04-01", returnDate: null, isOverdue: true, days: 11 },
  { bookTitle: "科学の発見", borrowerName: "鈴木一郎", loanDate: "2026-03-20", dueDate: "2026-04-03", returnDate: null, isOverdue: true, days: 9 },
];

function OverdueManagePage({ state }: { state: OverdueState }) {
  return (
    <AdminPortalShell activePage="overdue" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="延滞管理" description="延滞日数の長い順に確認し、利用者へ督促通知を送信します。" />
        <Notice tone="warning" title="延滞書籍 2件">前回の自動検出は本日 06:00 に完了しました。</Notice>
        {state === "loading" ? <LoadingSkeleton variant="table-row" count={5} /> : state === "empty" ? <EmptyState message="延滞中の貸出はありません" /> : (
          <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
            {overdueLoans.map((loan) => (
              <Panel key={loan.bookTitle}>
                <div style={{ ...actionsStyle, justifyContent: "space-between" }}>
                  <BookLoanStatusBadge status="overdue" />
                  <strong style={{ color: "var(--destructive)" }}>延滞 {loan.days}日</strong>
                </div>
                <LoanRecord {...loan} />
                <div style={actionsStyle}><Button size="sm">督促通知を送信</Button></div>
              </Panel>
            ))}
          </div>
        )}
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/OverdueManage", component: OverdueManagePage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof OverdueManagePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
