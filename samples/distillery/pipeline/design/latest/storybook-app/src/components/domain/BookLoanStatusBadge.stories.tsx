import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookLoanStatusBadge } from "./BookLoanStatusBadge";

const meta = { title: "Domain/BookLoanStatusBadge", component: BookLoanStatusBadge, tags: ["autodocs"] } satisfies Meta<typeof BookLoanStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = { args: { status: "available" } };
export const OnLoan: Story = { args: { status: "on_loan" } };
export const Overdue: Story = { args: { status: "overdue" } };
