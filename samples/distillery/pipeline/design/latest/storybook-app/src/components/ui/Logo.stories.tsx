import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Logo } from "./Logo";

const meta = {
  title: "Brand/Logo",
  component: Logo,
  tags: ["autodocs"],
  args: { variant: "full" },
  argTypes: { variant: { control: "select", options: ["full", "icon", "stacked"] } },
} satisfies Meta<typeof Logo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {};
export const Icon: Story = { args: { variant: "icon" } };
export const Stacked: Story = { args: { variant: "stacked" } };
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-12)", alignItems: "center" }}>
      <Logo variant="full" />
      <Logo variant="icon" />
      <Logo variant="stacked" />
    </div>
  ),
};
