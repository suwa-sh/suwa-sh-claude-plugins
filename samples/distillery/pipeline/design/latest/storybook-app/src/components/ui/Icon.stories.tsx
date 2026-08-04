import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Icon, iconNames } from "./Icon";

const meta = {
  title: "Brand/Icons",
  component: Icon,
  tags: ["autodocs"],
  args: { name: "book", size: 32 },
  argTypes: { name: { control: "select", options: iconNames } },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllIcons: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))", gap: "var(--spacing-6)" }}>
      {iconNames.map((name) => (
        <div key={name} style={{ textAlign: "center", color: "var(--foreground)" }}>
          <Icon name={name} size={32} />
          <div style={{ marginTop: "var(--spacing-2)", color: "var(--muted-foreground)", fontSize: "var(--font-size-xs)" }}>{name}</div>
        </div>
      ))}
    </div>
  ),
};
