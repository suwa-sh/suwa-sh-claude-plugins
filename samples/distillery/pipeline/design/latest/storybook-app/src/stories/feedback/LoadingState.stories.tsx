import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LoadingState } from '@/components/common/LoadingState'

const meta: Meta<typeof LoadingState> = {
  title: 'Common/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          'loading 表現の唯一の入口。画面側で独自の loading UI を作らず、必ずこのコンポーネントを使う。',
          '',
          '| kind | 表現 | 使う場面 |',
          '|------|------|----------|',
          '| `list` | SkeletonTable | 一覧の初回取得・再取得（行と列の形が決まっている） |',
          '| `card` | SkeletonCard | カード一覧（検索結果・KPI）の取得 |',
          '| `detail` | SkeletonDetail | 詳細・定義リストの取得 |',
          '| `line` | Skeleton | 見出し・1 行だけの取得 |',
          '| `action` | Spinner(inline) | 操作起点の短い待ち。レイアウトは変わらない |',
          '| `page` | Spinner(overlay) | 画面全体をブロックする待ち（遷移直後・確定処理） |',
          '',
          '制約: 同一領域で Skeleton と Spinner を併用しない / 常に `aria-busy` と読み上げラベルを伴う /',
          'ちらつきが問題になる領域だけ `delayMs`（推奨 300ms）で遅延表示する。',
          '',
          '### 取り込み先での参照（import 解決表）',
          '',
          'loading 表現に使う component の実体は次のファイルにある。',
          '画面実装は `LoadingState` だけを import し、`Skeleton` / `Spinner` を直接 import しない。',
          '',
          '| 指定 component | ファイル | export |',
          '|----------------|----------|--------|',
          '| `LoadingState` | `src/components/common/LoadingState.tsx` | `LoadingState`, `LoadingKind` |',
          '| `Skeleton` | `src/components/ui/Feedback.tsx` | `Skeleton`, `SkeletonTable`, `SkeletonCard`, `SkeletonDetail` |',
          '| `Spinner` | `src/components/ui/Feedback.tsx` | `Spinner` |',
          '',
          '`Skeleton` / `Spinner` は単独ファイルではなく `ui/Feedback.tsx` に同居する。',
          'ファイル名でコンポーネントを探すと見つからないため、design-event.yaml の',
          '`components.ui[].path` / `components.ui[].exports` を参照して解決する。',
        ].join('\n'),
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof LoadingState>

export const List: Story = {
  args: { kind: 'list', rows: 5, cols: 4, label: '貸出一覧を読み込み中' },
}

export const Card: Story = {
  args: { kind: 'card', rows: 3, label: '検索結果を読み込み中' },
}

export const Detail: Story = {
  args: { kind: 'detail', rows: 6, label: '書籍詳細を読み込み中' },
}

export const Line: Story = {
  args: { kind: 'line', label: '件数を読み込み中' },
}

export const Action: Story = {
  args: { kind: 'action', label: '検索を実行中' },
}

export const Page: Story = {
  args: { kind: 'page', label: '貸出を登録しています' },
  render: (args) => (
    <div
      style={{
        position: 'relative',
        minHeight: '12rem',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--card-radius)',
        background: 'var(--card-bg)',
        padding: 'var(--card-padding)',
      }}
    >
      <p style={{ color: 'var(--foreground-secondary)' }}>
        overlay は親要素（position: relative）を覆う。待ちの間は操作させない。
      </p>
      <LoadingState {...args} />
    </div>
  ),
}

export const Delayed: Story = {
  name: 'Delayed (300ms)',
  args: { kind: 'list', delayMs: 300, label: '一覧を読み込み中' },
}
