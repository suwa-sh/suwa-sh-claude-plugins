import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ErrorBanner } from "../../components/common/ErrorBanner";

const meta = { title: "Feedback/ErrorBanner", component: ErrorBanner, tags: ["autodocs"], args: { error: { type: "https://example.jp/problems/service-unavailable", title: "蔵書情報を取得できませんでした", status: 503, detail: "しばらく時間をおいてから、もう一度お試しください。" }, onDismiss: () => undefined } } satisfies Meta<typeof ErrorBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const ValidationError: Story = { args: { error: { title: "入力内容を確認してください", status: 400, detail: "ISBNは13桁の数字で入力してください。" } } };
