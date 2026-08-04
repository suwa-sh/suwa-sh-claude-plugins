import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatsSummaryCard } from "../../../components/domain/StatsSummaryCard";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { BarChart, ChoiceGroup, Notice, PageHeader, Panel, pageContentStyle, responsiveGridStyle } from "../../shared/PageStoryParts";

type StatsReportState = "default" | "loading";

function StatsReportPage({ state }: { state: StatsReportState }) {
  return (
    <AdminPortalShell activePage="stats" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="統計レポート" description="貸出実績の推移と人気書籍、ジャンル構成を期間別に確認します。" />
        <ChoiceGroup label="集計期間" options={["1か月", "3か月", "6か月", "12か月"]} selected="12か月" />
        {state === "loading" ? <LoadingSkeleton variant="card" count={7} /> : (
          <>
            <div style={responsiveGridStyle}>
              <StatsSummaryCard title="今月の貸出" value="1,284件" change={12.6} icon="history" variant="highlight" />
              <StatsSummaryCard title="新規利用者" value="86人" change={5.4} icon="users" />
              <StatsSummaryCard title="予約受付" value="214件" change={8.1} icon="calendar" />
              <StatsSummaryCard title="平均貸出日数" value="11.8日" change={-2.1} icon="clock" />
            </div>
            <Notice tone="info" title="今月の傾向">貸出数は前月比12.6%増加しています。文学と児童書の利用が伸びています。</Notice>
            <div style={responsiveGridStyle}>
              <Panel title="人気書籍ランキング" description="貸出回数 上位5件">
                <BarChart ariaLabel="人気書籍ランキング" values={[{ label: "吾輩は猫である", value: 184, max: 184 }, { label: "こころ", value: 168, max: 184 }, { label: "銀河鉄道の夜", value: 143, max: 184 }, { label: "走れメロス", value: 128, max: 184 }, { label: "羅生門", value: 119, max: 184 }]} />
              </Panel>
              <Panel title="ジャンル別貸出構成比">
                <BarChart ariaLabel="ジャンル別貸出構成比" values={[{ label: "文学", value: 38, max: 100 }, { label: "児童書", value: 21, max: 100 }, { label: "社会科学", value: 16, max: 100 }, { label: "自然科学", value: 14, max: 100 }, { label: "その他", value: 11, max: 100 }]} />
              </Panel>
            </div>
            <Panel title="期間別貸出推移" description="過去6か月の月次貸出件数">
              <BarChart ariaLabel="期間別貸出推移" values={[{ label: "2025年11月", value: 982, max: 1284 }, { label: "2025年12月", value: 1041, max: 1284 }, { label: "2026年1月", value: 1108, max: 1284 }, { label: "2026年2月", value: 1062, max: 1284 }, { label: "2026年3月", value: 1140, max: 1284 }, { label: "2026年4月", value: 1284, max: 1284 }]} />
            </Panel>
          </>
        )}
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/StatsReport", component: StatsReportPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof StatsReportPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { state: "loading" } };
