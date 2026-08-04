import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { ReservationStatusBadge } from "../../../components/domain/ReservationStatusBadge";
import { Button } from "../../../components/ui/Button";
import { ErrorBanner } from "../../../components/common/ErrorBanner";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import { Notice, PageHeader, Panel, actionsStyle, pageContentStyle, sampleBooks } from "../../shared/PageStoryParts";

type ReservationNewState = "default" | "completed" | "error" | "loading";

function ReservationNewPage({ state }: { state: ReservationNewState }) {
  return (
    <UserPortalShell activePage="reservations" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader title="予約申請" description="貸出中の書籍を予約し、返却後の確保通知を受け取れます。" />
        {state === "error" && (
          <ErrorBanner error={{ title: "予約できません", status: 409, detail: "この書籍はすでに予約済みです。" }} />
        )}
        {state === "completed" && (
          <Notice tone="success" title="予約を受け付けました">現在の予約順位は2番目です。確保でき次第メールでお知らせします。</Notice>
        )}
        {state === "loading" ? <LoadingSkeleton variant="card" count={1} /> : <BookCard {...sampleBooks.kokoro} variant="detailed" />}
        <Panel title="予約内容">
          <div style={actionsStyle}>
            <span style={{ color: "var(--muted-foreground)" }}>現在の状態</span>
            <ReservationStatusBadge status={state === "completed" ? "pending" : "pending"} />
          </div>
          <p style={{ color: "var(--foreground)", lineHeight: 1.7, margin: 0 }}>予約確保後は3開館日以内に貸出手続きを行ってください。</p>
          <div style={actionsStyle}>
            <Button size="lg" disabled={state === "loading" || state === "completed"}>予約する</Button>
            <Button variant="outline">蔵書検索へ戻る</Button>
          </div>
        </Panel>
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/ReservationNew",
  component: ReservationNewPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof ReservationNewPage>;

export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Completed: Story = { args: { state: "completed" } };
export const Error: Story = { args: { state: "error" } };
export const Loading: Story = { args: { state: "loading" } };
