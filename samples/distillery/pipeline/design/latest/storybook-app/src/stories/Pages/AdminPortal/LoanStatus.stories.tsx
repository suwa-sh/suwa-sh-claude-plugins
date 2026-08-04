import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookLoanStatusBadge } from "../../../components/domain/BookLoanStatusBadge";
import { LoanRecord } from "../../../components/domain/LoanRecord";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { PaginatedList } from "../../../components/common/PaginatedList";
import { PageHeader, Panel, actionsStyle, pageContentStyle } from "../../shared/PageStoryParts";

type LoanStatusState = "default" | "empty" | "loading";
const loans = [
  { id: "L-1052", bookTitle: "吾輩は猫である", borrowerName: "田中太郎", loanDate: "2026-04-12", dueDate: "2026-04-26", returnDate: null, isOverdue: false },
  { id: "L-1041", bookTitle: "こころ", borrowerName: "佐藤美咲", loanDate: "2026-03-18", dueDate: "2026-04-01", returnDate: null, isOverdue: true },
];

function LoanStatusPage({ state }: { state: LoanStatusState }) {
  return (
    <AdminPortalShell activePage="loans" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="貸出状況一覧" description="全利用者の貸出中書籍を確認できます。20件単位で表示します。" />
        {state === "loading" ? <LoadingSkeleton variant="table-row" count={6} /> : state === "empty" ? <EmptyState message="貸出中の書籍はありません" /> : (
          <PaginatedList
            items={loans}
            total={25}
            page={1}
            perPage={20}
            onPageChange={() => undefined}
            ariaLabel="貸出状況一覧"
            renderItem={(loan) => (
              <Panel>
                <div style={actionsStyle}><BookLoanStatusBadge status={loan.isOverdue ? "overdue" : "on_loan"} /></div>
                <LoanRecord {...loan} />
              </Panel>
            )}
          />
        )}
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/LoanStatus", component: LoanStatusPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof LoanStatusPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
