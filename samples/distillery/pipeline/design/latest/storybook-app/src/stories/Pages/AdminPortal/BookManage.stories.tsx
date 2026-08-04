import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { BookSearchFilter } from "../../../components/domain/BookSearchFilter";
import { Button } from "../../../components/ui/Button";
import { AdminPortalShell } from "../../../components/common/AdminPortalShell";
import { ConfirmActionModal } from "../../../components/common/ConfirmActionModal";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { PageHeader, Panel, actionsStyle, pageContentStyle, responsiveGridStyle, sampleBooks } from "../../shared/PageStoryParts";

type BookManageState = "default" | "dialog" | "loading";

function BookManagePage({ state }: { state: BookManageState }) {
  const books = [sampleBooks.cat, sampleBooks.kokoro, sampleBooks.science];
  return (
    <AdminPortalShell activePage="books" userName="山田花子">
      <div style={pageContentStyle}>
        <PageHeader title="蔵書管理" description="蔵書の検索、編集、削除を行います。" action={<Button>新規登録</Button>} />
        <BookSearchFilter genres={["文学", "社会科学", "自然科学"]} materialTypes={["紙書籍", "電子書籍"]} onSearch={() => undefined} />
        {state === "loading" ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : (
          <div style={responsiveGridStyle}>
            {books.map((book) => (
              <Panel key={book.isbn}>
                <BookCard {...book} variant="compact" />
                <div style={actionsStyle}>
                  <Button size="sm" variant="outline">編集</Button>
                  <Button size="sm" variant="destructive" disabled={book.status !== "available"}>削除</Button>
                </div>
              </Panel>
            ))}
          </div>
        )}
        <ConfirmActionModal
          isOpen={state === "dialog"}
          title="書籍を削除しますか？"
          message="書籍『吾輩は猫である』を削除します。この操作は取り消せません。"
          confirmLabel="削除する"
          onConfirm={() => undefined}
          onCancel={() => undefined}
        />
      </div>
    </AdminPortalShell>
  );
}

const meta = { title: "Pages/AdminPortal/BookManage", component: BookManagePage, tags: ["autodocs"], parameters: { layout: "fullscreen" }, args: { state: "default" } } satisfies Meta<typeof BookManagePage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const WithDeleteDialog: Story = { args: { state: "dialog" } };
export const Loading: Story = { args: { state: "loading" } };
