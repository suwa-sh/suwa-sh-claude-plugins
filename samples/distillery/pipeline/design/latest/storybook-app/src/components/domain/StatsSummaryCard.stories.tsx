import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StatsSummaryCard } from "./StatsSummaryCard";

const meta = {
  title: "Domain/StatsSummaryCard",
  component: StatsSummaryCard,
  tags: ["autodocs"],
  args: { title: "総蔵書数", value: "12,480冊", change: 3.2, icon: "book" },
} satisfies Meta<typeof StatsSummaryCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Highlight: Story = { args: { title: "今月の貸出", value: "864件", change: 8.4, icon: "chart", variant: "highlight" } };
export const Decrease: Story = { args: { title: "新規登録者", value: "42人", change: -2.1, icon: "users" } };
