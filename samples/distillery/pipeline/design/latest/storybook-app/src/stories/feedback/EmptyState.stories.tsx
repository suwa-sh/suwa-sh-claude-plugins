import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { EmptyState } from "../../components/common/EmptyState";

const meta = { title: "Feedback/EmptyState", component: EmptyState, tags: ["autodocs"], args: { message: "条件に一致する書籍はありません。検索条件を変更してお試しください。" } } satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithAction: Story = { args: { actionLabel: "検索条件をクリア", onAction: () => undefined } };
