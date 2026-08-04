import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { BookForm, type EntityFormState } from "../../shared/EntityForms";
import { PageHeader, pageContentStyle } from "../../shared/PageStoryParts";

function BookEditPage({ state }: { state: EntityFormState }) {
  return (
    <AdminPortalShell activePage="books" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="蔵書編集" description="登録済みの書誌情報を確認し、必要な項目を更新します。" />
        <BookForm mode="edit" state={state} />
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/BookEdit", component: BookEditPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof BookEditPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { state: "loading" } };
