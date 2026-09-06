import type { Meta, StoryObj } from '@storybook/nextjs-vite'

const meta: Meta = {
  title: 'Brand/Logo',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'ロゴは 3 バリアント。モチーフは「開いた本」と「並んだ背表紙」で、左半分に利用者ポータル色（Libra Blue）、右半分に司書ポータル色（Stack Teal）を配し、2 つのポータルが 1 つの蔵書を共有することを表す。SVG コードとしてリポジトリ内に持つため CDN 依存がない。',
      },
    },
  },
}
export default meta
type Story = StoryObj

const Frame: React.FC<{ label: string; note: string; children: React.ReactNode }> = ({
  label,
  note,
  children,
}) => (
  <div
    className="flex flex-col"
    style={{
      gap: 'var(--spacing-2)',
      padding: 'var(--card-padding)',
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--card-radius)',
    }}
  >
    <div
      className="flex items-center justify-center"
      style={{
        minHeight: '8rem',
        background: 'var(--background-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--spacing-4)',
      }}
    >
      {children}
    </div>
    <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--foreground)' }}>
      {label}
    </span>
    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>
      {note}
    </span>
  </div>
)

export const AllVariants: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(16rem, 1fr))',
        gap: 'var(--component-gap)',
      }}
    >
      <Frame
        label="logo-full"
        note="横長。ヘッダー・サイドバー・ドキュメントの見出しに使う（推奨高さ 32–64px）"
      >
        <img src="/assets/logo-full.svg" alt="Libra 図書館蔵書管理システム" style={{ height: 56 }} />
      </Frame>
      <Frame label="logo-icon" note="正方形。favicon・アバター・折りたたみサイドバーに使う（16–64px）">
        <img src="/assets/logo-icon.svg" alt="Libra" style={{ height: 56 }} />
      </Frame>
      <Frame label="logo-stacked" note="縦組み。ログイン画面・印刷物・幅の狭い領域に使う（推奨高さ 80–128px）">
        <img src="/assets/logo-stacked.svg" alt="Libra 図書館蔵書管理システム" style={{ height: 96 }} />
      </Frame>
    </div>
  ),
}

export const OnSurfaces: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      {[
        ['var(--background)', '標準背景'],
        ['var(--background-subtle)', '控えめ背景'],
        ['var(--background-muted)', 'ミュート背景'],
      ].map(([bg, label]) => (
        <div
          key={label}
          className="flex items-center"
          style={{
            gap: 'var(--spacing-4)',
            background: bg,
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-4)',
          }}
        >
          <img src="/assets/logo-full.svg" alt="Libra" style={{ height: 40 }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>
            {label}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-end" style={{ gap: 'var(--spacing-6)' }}>
      {[16, 24, 32, 48, 64].map((h) => (
        <div key={h} className="flex flex-col items-center" style={{ gap: 'var(--spacing-1)' }}>
          <img src="/assets/logo-icon.svg" alt="Libra" style={{ height: h }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            {h}px
          </span>
        </div>
      ))}
    </div>
  ),
}
