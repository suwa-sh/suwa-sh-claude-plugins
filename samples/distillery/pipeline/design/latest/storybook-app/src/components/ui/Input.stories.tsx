import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";

const meta = {
  title: "UI/Input",
  component: Input,
  tags: ["autodocs"],
  args: {
    label: "検索キーワード",
    placeholder: "タイトル・著者・ISBNを入力",
  },
  decorators: [(Story) => <div style={{ maxWidth: "28rem" }}><Story /></div>],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: "複数の条件を組み合わせて検索できます。" } };
export const Required: Story = { args: { label: "ISBN", required: true, placeholder: "978-4-10-101001-4" } };
export const Error: Story = { args: { label: "ISBN", defaultValue: "1234", error: "ISBNは10桁または13桁で入力してください。" } };
export const Disabled: Story = { args: { disabled: true, defaultValue: "編集できない項目" } };
