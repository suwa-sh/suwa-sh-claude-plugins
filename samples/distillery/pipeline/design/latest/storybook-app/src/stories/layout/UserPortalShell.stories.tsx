import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { UserPortalShell } from "../../components/common/UserPortalShell";

const meta = { title: "Layout/UserPortalShell", component: UserPortalShell, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { activePage: "books", userName: "山田 花子", children: <section><h1 style={{ marginTop: 0 }}>蔵書検索</h1><p style={{ color: "var(--muted-foreground)" }}>読みたい本を検索できます。</p></section> } } satisfies Meta<typeof UserPortalShell>;
export default meta;
type Story = StoryObj<typeof meta>;

export const BookSearch: Story = {};
export const Reservations: Story = { args: { activePage: "reservations", children: <h1 style={{ marginTop: 0 }}>予約状況</h1> } };
