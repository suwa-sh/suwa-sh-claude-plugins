import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Input, Select, Textarea } from './Input'

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'タイトル', placeholder: '吾輩は猫である' },
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}
export const WithIcon: Story = { args: { label: '利用者番号', icon: 'id-card', mono: true, placeholder: 'U-000123' } }
export const Required: Story = { args: { required: true, hint: '必須項目です' } }
export const Error: Story = { args: { error: 'タイトルを入力してください', defaultValue: '' } }
export const Disabled: Story = { args: { disabled: true, defaultValue: '編集できません' } }
export const SelectField: Story = {
  render: () => (
    <div style={{ maxWidth: 320 }}>
      <Select label="ジャンル" required options={['文学', '社会科学', '自然科学', '技術', '芸術', '歴史', '児童書', 'その他'].map((g) => ({ value: g, label: g }))} defaultValue="技術" />
    </div>
  ),
}
export const TextareaField: Story = {
  render: () => (
    <div style={{ maxWidth: 480 }}>
      <Textarea label="住所" defaultValue="東京都千代田区一ツ橋 1-1-1" />
    </div>
  ),
}
