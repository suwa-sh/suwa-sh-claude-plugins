import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { StatsSummaryCard } from "../../../components/domain/StatsSummaryCard";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { BarChart, PageHeader, Panel, pageContentStyle, responsiveGridStyle, sampleBooks } from "../../shared/PageStoryParts";

type InventoryState = "default" | "loading";

function InventoryPage({ state }: { state: InventoryState }) {
  return (
    <AdminPortalShell activePage="inventory" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="在庫状況" description="蔵書全体の在庫状態とジャンル別の構成を確認できます。" />
        {state === "loading" ? <LoadingSkeleton variant="card" count={6} /> : (
          <>
            <div style={responsiveGridStyle}>
              <StatsSummaryCard title="総蔵書数" value="12,480冊" change={2.4} icon="book" />
              <StatsSummaryCard title="在庫あり" value="9,842冊" change={1.1} icon="shield-check" variant="highlight" />
              <StatsSummaryCard title="貸出中" value="2,603冊" change={4.8} icon="history" />
              <StatsSummaryCard title="延滞中" value="35冊" change={-8.2} icon="clock" />
            </div>
            <div style={responsiveGridStyle}>
              <Panel title="在庫状態別比率" description="総蔵書数に占める各状態の割合">
                <BarChart ariaLabel="在庫状態別比率" values={[{ label: "在庫あり", value: 9842, max: 12480 }, { label: "貸出中", value: 2603, max: 12480 }, { label: "延滞中", value: 35, max: 12480 }]} />
              </Panel>
              <Panel title="ジャンル別蔵書数">
                <BarChart ariaLabel="ジャンル別蔵書数" values={[{ label: "文学", value: 3280, max: 3280 }, { label: "社会科学", value: 2410, max: 3280 }, { label: "自然科学", value: 1960, max: 3280 }, { label: "児童書", value: 1840, max: 3280 }]} />
              </Panel>
            </div>
            <Panel title="要確認の蔵書" description="延滞中の蔵書から一部を表示しています。">
              <div style={responsiveGridStyle}><BookCard {...sampleBooks.science} variant="compact" /></div>
            </Panel>
          </>
        )}
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/Inventory", component: InventoryPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof InventoryPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { state: "loading" } };
