import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Icon, iconNames } from './Icon'

const meta: Meta<typeof Icon> = {
  title: 'Brand/Icons',
  component: Icon,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Lucide 準拠のアウトラインアイコン（24×24 / stroke / `currentColor`）。SVG をリポジトリ内に持つため CDN 依存がなく、親要素の色トークンからそのまま着色できる。実体は `public/assets/icons/*.svg` と同一。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Icon>

export const Single: Story = { args: { name: 'book', size: 32 } }

export const AllIcons: Story = {
  render: () => (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(7rem, 1fr))',
        gap: 'var(--component-gap)',
      }}
    >
      {iconNames.map((name) => (
        <div
          key={name}
          className="flex flex-col items-center justify-center"
          style={{
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-3)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--card-bg)',
            color: 'var(--foreground)',
          }}
        >
          <Icon name={name} size={24} />
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
              fontFamily: 'var(--font-family-mono)',
              textAlign: 'center',
              overflowWrap: 'anywhere',
            }}
          >
            {name}
          </span>
        </div>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex items-end" style={{ gap: 'var(--spacing-4)', color: 'var(--primary)' }}>
      {[12, 16, 20, 24, 32, 48].map((s) => (
        <div key={s} className="flex flex-col items-center" style={{ gap: 'var(--spacing-1)' }}>
          <Icon name="library" size={s} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            {s}px
          </span>
        </div>
      ))}
    </div>
  ),
}

export const ColorFollowsToken: Story = {
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-4)' }}>
      {[
        ['--primary', 'primary'],
        ['--success', 'success'],
        ['--warning', 'warning'],
        ['--destructive', 'destructive'],
        ['--analysis', 'analysis'],
        ['--foreground-muted', 'muted'],
      ].map(([token, label]) => (
        <div
          key={token}
          className="flex flex-col items-center"
          style={{ gap: 'var(--spacing-1)', color: `var(${token})` }}
        >
          <Icon name="book-open" size={28} />
          <span style={{ fontSize: 'var(--font-size-xs)' }}>{label}</span>
        </div>
      ))}
    </div>
  ),
}
