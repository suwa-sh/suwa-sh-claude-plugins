import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input } from './Input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: '24rem' }}>
        <Story />
      </div>
    ),
  ],
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: { label: 'タイトル', placeholder: '書名を入力' },
}
export const WithIcon: Story = {
  args: { label: 'キーワード', placeholder: '書名・著者・ISBN', iconLeft: 'search' },
}
export const Required: Story = {
  args: { label: 'ISBN', placeholder: '978-4-00-000000-0', required: true, hint: 'ISO 2108 準拠の 13 桁' },
}
export const WithSuffix: Story = {
  args: { label: '貸出上限', type: 'number', defaultValue: 5, suffix: '冊' },
}
export const WithError: Story = {
  args: {
    label: 'ISBN',
    defaultValue: '123',
    error: 'ISBN は 13 桁で入力してください',
  },
}
export const DateInput: Story = {
  args: { label: '集計開始日', type: 'date', defaultValue: '2026-04-01' },
}
export const Disabled: Story = {
  args: { label: '利用者番号', defaultValue: 'U-2026-0184', disabled: true, hint: '採番後は変更できません' },
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      <Input label="キーワード" placeholder="書名・著者・ISBN" iconLeft="search" />
      <Input label="ISBN" placeholder="978-4-00-000000-0" required hint="ISO 2108 準拠の 13 桁" />
      <Input label="貸出上限" type="number" defaultValue={5} suffix="冊" />
      <Input label="連絡先" defaultValue="tanaka@example" error="メールアドレスの形式が正しくありません" />
      <Input label="利用者番号" defaultValue="U-2026-0184" disabled hint="採番後は変更できません" />
    </div>
  ),
}
