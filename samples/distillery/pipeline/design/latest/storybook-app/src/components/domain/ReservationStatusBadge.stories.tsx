import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { ReservationStatusBadge } from "./ReservationStatusBadge";

const meta = { title: "Domain/ReservationStatusBadge", component: ReservationStatusBadge, tags: ["autodocs"] } satisfies Meta<typeof ReservationStatusBadge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { status: "pending" } };
export const Reserved: Story = { args: { status: "reserved" } };
export const Cancelled: Story = { args: { status: "cancelled" } };
