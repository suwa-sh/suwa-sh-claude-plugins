import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { ReservationStatusBadge } from "../../../components/domain/ReservationStatusBadge";
import { Button } from "../../../components/ui/Button";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import { PageHeader, Panel, actionsStyle, pageContentStyle, sampleBooks } from "../../shared/PageStoryParts";

type ReservationStatusState = "default" | "empty" | "loading";

function ReservationStatusPage({ state }: { state: ReservationStatusState }) {
  return (
    <UserPortalShell activePage="reservations" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="予約状況" description="予約順位と書籍の確保期限を確認できます。" />
        {state === "loading" ? (
          <LoadingSkeleton variant="card" count={3} />
        ) : state === "empty" ? (
          <EmptyState message="現在有効な予約はありません" actionLabel="蔵書を探す" />
        ) : (
          <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
            <Panel>
              <BookCard {...sampleBooks.kokoro} variant="compact" />
              <div style={actionsStyle}>
                <ReservationStatusBadge status="pending" />
                <span style={{ color: "var(--foreground)" }}>予約順位 2番</span>
              </div>
            </Panel>
            <Panel>
              <BookCard {...sampleBooks.cat} variant="compact" />
              <div style={actionsStyle}>
                <ReservationStatusBadge status="reserved" />
                <strong style={{ color: "var(--success)" }}>確保期限 2026年4月15日</strong>
                <Button size="sm">貸出手続きへ</Button>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/ReservationStatus",
  component: ReservationStatusPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof ReservationStatusPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
