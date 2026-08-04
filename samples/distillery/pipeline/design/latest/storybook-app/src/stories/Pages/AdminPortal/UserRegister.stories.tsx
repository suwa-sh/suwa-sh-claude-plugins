import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { UserForm, type EntityFormState } from "../../shared/EntityForms";
import { PageHeader, pageContentStyle } from "../../shared/PageStoryParts";

function UserRegisterPage({ state }: { state: EntityFormState }) {
  return (
    <AdminPortalShell activePage="users" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="利用者登録" description="貸出サービスを利用する方の情報を登録します。" />
        <UserForm mode="register" state={state} />
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/UserRegister", component: UserRegisterPage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof UserRegisterPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const ValidationError: Story = { args: { state: "validation" } };
export const ServerError: Story = { args: { state: "server" } };
