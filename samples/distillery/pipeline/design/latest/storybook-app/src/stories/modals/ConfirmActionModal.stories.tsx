import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ConfirmActionModal } from "../../components/common/ConfirmActionModal";

const meta = { title: "Modals/ConfirmActionModal", component: ConfirmActionModal, tags: ["autodocs"], args: { isOpen: true, title: "予約をキャンセルしますか", message: "キャンセル後に同じ順番へ戻すことはできません。内容を確認してから実行してください。", confirmLabel: "予約をキャンセル", onConfirm: () => undefined, onCancel: () => undefined } } satisfies Meta<typeof ConfirmActionModal>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Processing: Story = { args: { isLoading: true } };
export const Closed: Story = { args: { isOpen: false } };
