import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { ReservationStatusBadge } from "../../../components/domain/ReservationStatusBadge";
import { Button } from "../../../components/ui/Button";
import { ConfirmActionModal } from "../../../components/common/ConfirmActionModal";
import { EmptyState } from "../../../components/common/EmptyState";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import { PageHeader, Panel, actionsStyle, pageContentStyle, sampleBooks } from "../../shared/PageStoryParts";

type ReservationManageState = "default" | "dialog" | "empty";

function ReservationManagePage({ state }: { state: ReservationManageState }) {
  return (
    <UserPortalShell activePage="reservations" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="予約管理" description="予約中の書籍と確保状況を確認し、不要な予約をキャンセルできます。" />
        {state === "empty" ? (
          <EmptyState message="現在有効な予約はありません" actionLabel="蔵書を探す" />
        ) : (
          <Panel>
            <BookCard {...sampleBooks.kokoro} variant="detailed" />
            <div style={{ ...actionsStyle, justifyContent: "space-between" }}>
              <ReservationStatusBadge status="pending" />
              <Button variant="destructive" size="sm">予約をキャンセル</Button>
            </div>
          </Panel>
        )}
        <ConfirmActionModal
          isOpen={state === "dialog"}
          title="予約をキャンセルしますか？"
          message="書籍『こころ』の予約を取り消します。この操作は取り消せません。"
          confirmLabel="キャンセルする"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/ReservationManage",
  component: ReservationManagePage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof ReservationManagePage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithCancelDialog: Story = { args: { state: "dialog" } };
export const Empty: Story = { args: { state: "empty" } };
