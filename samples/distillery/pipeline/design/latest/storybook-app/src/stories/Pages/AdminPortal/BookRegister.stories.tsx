import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { BookForm, type EntityFormState } from "../../shared/EntityForms";
import { PageHeader, pageContentStyle } from "../../shared/PageStoryParts";

function BookRegisterPage({ state }: { state: EntityFormState }) {
  return (
    <AdminPortalShell activePage="books" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="蔵書登録" description="新しい書籍の書誌情報と配架情報を登録します。" />
        <BookForm mode="register" state={state} />
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/BookRegister", component: BookRegisterPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof BookRegisterPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ValidationError: Story = { args: { state: "validation" } };
export const ServerError: Story = { args: { state: "server" } };
