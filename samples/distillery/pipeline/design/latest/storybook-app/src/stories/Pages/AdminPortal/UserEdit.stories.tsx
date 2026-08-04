import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { UserForm, type EntityFormState } from "../../shared/EntityForms";
import { PageHeader, pageContentStyle } from "../../shared/PageStoryParts";

function UserEditPage({ state }: { state: EntityFormState }) {
  return (
    <AdminPortalShell activePage="users" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="利用者編集" description="利用者情報を確認し、連絡先や利用状態を更新します。" />
        <UserForm mode="edit" state={state} />
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/UserEdit", component: UserEditPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof UserEditPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Loading: Story = { args: { state: "loading" } };
