import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { BookCard } from "../../../components/domain/BookCard";
import { BookSearchFilter } from "../../../components/domain/BookSearchFilter";
import { EmptyState } from "../../../components/common/EmptyState";
import { LoadingSkeleton } from "../../../components/common/LoadingSkeleton";
import { UserPortalShell } from "../../../components/common/UserPortalShell";
import {
  PageHeader,
  pageContentStyle,
  responsiveGridStyle,
  sampleBooks,
} from "../../shared/PageStoryParts";

type BookSearchState = "default" | "detailed" | "empty" | "loading";

function BookSearchPage({ state }: { state: BookSearchState }) {
  const books = [sampleBooks.cat, sampleBooks.kokoro, sampleBooks.science];
  return (
    <UserPortalShell activePage="books" userName="田中太郎">
      <div style={pageContentStyle}>
        <PageHeader
          title="蔵書検索"
          description="書名・著者名から検索し、ジャンルや資料種別で絞り込めます。"
        />
        <BookSearchFilter
          genres={["文学", "社会科学", "自然科学", "児童書"]}
          materialTypes={["紙書籍", "電子書籍"]}
          onSearch={() => undefined}
        />
        {state === "loading" ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : state === "empty" ? (
          <EmptyState message="条件に一致する書籍が見つかりませんでした" actionLabel="検索条件をクリア" />
        ) : (
          <section aria-label="検索結果" style={{ display: "grid", gap: "var(--spacing-4)" }}>
            <p style={{ color: "var(--muted-foreground)", margin: 0 }}>検索結果 3件</p>
            <div style={responsiveGridStyle}>
              {books.map((book) => (
                <BookCard
                  key={book.isbn}
                  {...book}
                  variant={state === "detailed" ? "detailed" : "compact"}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </UserPortalShell>
  );
}

const meta = {
  title: "Pages/UserPortal/BookSearch",
  component: BookSearchPage,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  args: { state: "default" },
} satisfies Meta<typeof BookSearchPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DetailedResults: Story = { args: { state: "detailed" } };
export const EmptyResults: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
