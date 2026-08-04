import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { LoadingSkeleton } from "../../components/common/LoadingSkeleton";

const meta = { title: "Feedback/LoadingSkeleton", component: LoadingSkeleton, tags: ["autodocs"], args: { count: 3 } } satisfies Meta<typeof LoadingSkeleton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const TableRows: Story = { args: { variant: "table-row", count: 5 } };
export const Cards: Story = { args: { variant: "card", count: 3 } };
export const Form: Story = { args: { variant: "form", count: 4 } };
