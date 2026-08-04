import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminPortalShell } from "../../components/common/AdminPortalShell";

const meta = { title: "Layout/AdminPortalShell", component: AdminPortalShell, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { activePage: "books", userName: "佐藤 司書", children: <section><h1 style={{ marginTop: 0 }}>蔵書管理</h1><p style={{ color: "var(--muted-foreground)" }}>蔵書の登録・編集・削除を行います。</p></section> } } satisfies Meta<typeof AdminPortalShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Collapsed: Story = { args: { sidebarCollapsed: true } };
export const Statistics: Story = { args: { activePage: "stats", children: <h1 style={{ marginTop: 0 }}>統計レポート</h1> } };
