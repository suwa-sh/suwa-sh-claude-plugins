import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoanRecord } from "./LoanRecord";

const meta = {
  title: "Domain/LoanRecord",
  component: LoanRecord,
  tags: ["autodocs"],
  args: { bookTitle: "銀河鉄道の夜", borrowerName: "山田 花子", loanDate: "2026年7月1日", dueDate: "2026年7月15日", returnDate: null, isOverdue: false },
  decorators: [(Story) => <div style={{ overflowX: "auto" }}><Story /></div>],
} satisfies Meta<typeof LoanRecord>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Returned: Story = { args: { returnDate: "2026年7月12日" } };
export const Overdue: Story = { args: { dueDate: "2026年6月15日", isOverdue: true } };
