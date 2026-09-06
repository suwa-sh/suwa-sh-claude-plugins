import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Icon, iconNames } from './Icon'
import { Logo } from './Logo'

const meta: Meta = {
  title: 'Brand/Icons',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const AllIcons: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 16 }}>
      {iconNames.map((name) => (
        <div key={name} style={{ textAlign: 'center', padding: 8, borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <Icon name={name} size={28} />
          <div style={{ fontSize: 11, color: 'var(--foreground-secondary)', marginTop: 6, fontFamily: 'var(--font-family-mono)' }}>{name}</div>
        </div>
      ))}
    </div>
  ),
}

export const Colored: Story = {
  render: () => (
    <div className="flex items-center" style={{ gap: 16 }}>
      <span style={{ color: 'var(--primary)' }}><Icon name="book" size={32} /></span>
      <span style={{ color: 'var(--success)' }}><Icon name="check-circle" size={32} /></span>
      <span style={{ color: 'var(--warning)' }}><Icon name="bell" size={32} /></span>
      <span style={{ color: 'var(--destructive)' }}><Icon name="alert-triangle" size={32} /></span>
    </div>
  ),
}

export const Logos: Story = {
  name: 'Logo',
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 40 }}>
      <Logo variant="full" height={48} />
      <Logo variant="icon" height={48} />
      <Logo variant="stacked" height={88} />
    </div>
  ),
}
