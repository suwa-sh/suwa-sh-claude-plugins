import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";

const meta = {
  title: "UI/Button",
  component: Button,
  tags: ["autodocs"],
  args: { children: "蔵書を検索" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "secondary", "outline", "ghost", "destructive"],
    },
    size: { control: "select", options: ["sm", "md", "lg"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary", children: "詳細を見る" } };
export const Outline: Story = { args: { variant: "outline", children: "キャンセル" } };
export const Ghost: Story = { args: { variant: "ghost", children: "戻る" } };
export const Destructive: Story = { args: { variant: "destructive", children: "予約を取り消す" } };
export const Small: Story = { args: { size: "sm", children: "小サイズ" } };
export const Large: Story = { args: { size: "lg", children: "貸出手続きへ" } };
export const Disabled: Story = { args: { disabled: true, children: "現在利用できません" } };
