import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "./BookCard";

const meta = {
  title: "Domain/BookCard",
  component: BookCard,
  tags: ["autodocs"],
  args: {
    title: "吾輩は猫である",
    author: "夏目漱石",
    isbn: "978-4-00-310101-8",
    publisher: "岩波書店",
    genre: "日本文学",
    materialType: "図書",
    location: "一般書架 913.6",
    status: "available",
  },
} satisfies Meta<typeof BookCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {};
export const Detailed: Story = { args: { variant: "detailed" } };
export const OnLoan: Story = { args: { status: "on_loan" } };
export const Overdue: Story = { args: { status: "overdue" } };
