import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoanRecord } from "../../../components/domain/LoanRecord";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { PaginatedList } from "../../../components/common/PaginatedList";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import { PageHeader, pageContentStyle } from "../../shared/PageStoryParts";

type LoanHistoryState = "default" | "empty" | "loading";

const history = [
  { id: "L-1048", bookTitle: "吾輩は猫である", borrowerName: "田中太郎", loanDate: "2026-03-08", dueDate: "2026-03-22", returnDate: "2026-03-20", isOverdue: false },
  { id: "L-1002", bookTitle: "こころ", borrowerName: "田中太郎", loanDate: "2026-01-14", dueDate: "2026-01-28", returnDate: "2026-02-02", isOverdue: true },
  { id: "L-0971", bookTitle: "銀河鉄道の夜", borrowerName: "田中太郎", loanDate: "2025-12-03", dueDate: "2025-12-17", returnDate: "2025-12-15", isOverdue: false },
];

function LoanHistoryPage({ state }: { state: LoanHistoryState }) {
  return (
    <UserPortalShell activePage="history" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="貸出履歴" description="これまでに借りた書籍と返却状況を確認できます。" />
        {state === "loading" ? (
          <LoadingSkeleton variant="table-row" count={5} />
        ) : state === "empty" ? (
          <EmptyState message="貸出履歴はまだありません" actionLabel="蔵書を探す" />
        ) : (
          <PaginatedList
            items={history}
            total={23}
            page={1}
            perPage={20}
            onPageChange={() => undefined}
            ariaLabel="貸出履歴"
            renderItem={(loan) => <LoanRecord {...loan} />}
          />
        )}
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/LoanHistory",
  component: LoanHistoryPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof LoanHistoryPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
