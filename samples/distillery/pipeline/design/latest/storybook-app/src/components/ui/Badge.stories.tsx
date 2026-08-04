import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./Badge";

const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  args: { children: "一般" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "success", "warning", "destructive", "info", "virtual", "outline"],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Success: Story = { args: { variant: "success", children: "在庫あり" } };
export const Warning: Story = { args: { variant: "warning", children: "返却期限間近" } };
export const Destructive: Story = { args: { variant: "destructive", children: "延滞中" } };
export const Info: Story = { args: { variant: "info", children: "貸出中" } };
export const Virtual: Story = { args: { variant: "virtual", children: "電子書籍" } };
export const Outline: Story = { args: { variant: "outline", children: "児童書" } };
