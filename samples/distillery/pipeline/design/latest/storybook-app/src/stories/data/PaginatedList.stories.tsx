import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { PaginatedList } from "../../components/common/PaginatedList";

const books = ["吾輩は猫である", "銀河鉄道の夜", "羅生門"];

const meta = {
  title: "Data/PaginatedList",
  component: PaginatedList,
  tags: ["autodocs"],
  args: {
    items: books,
    total: 48,
    page: 1,
    perPage: 20,
    onPageChange: () => undefined,
    renderItem: (title: unknown) => <div style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "var(--radius-lg)", padding: "var(--spacing-4)" }}>{String(title)}</div>,
  },
} satisfies Meta<typeof PaginatedList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LastPage: Story = { args: { items: ["人間失格", "こころ", "雪国", "走れメロス", "坊っちゃん", "舞姫", "山月記", "檸檬"], page: 3 } };
