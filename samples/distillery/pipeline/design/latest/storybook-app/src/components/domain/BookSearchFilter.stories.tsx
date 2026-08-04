import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookSearchFilter } from "./BookSearchFilter";

const meta = {
  title: "Domain/BookSearchFilter",
  component: BookSearchFilter,
  tags: ["autodocs"],
  args: { genres: ["日本文学", "海外文学", "自然科学", "児童書"], materialTypes: ["図書", "雑誌", "視聴覚資料"], onSearch: () => undefined },
} satisfies Meta<typeof BookSearchFilter>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
