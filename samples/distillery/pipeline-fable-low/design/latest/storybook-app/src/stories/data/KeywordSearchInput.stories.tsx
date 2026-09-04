import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { KeywordSearchInput } from '@/components/common/KeywordSearchInput'

const meta: Meta<typeof KeywordSearchInput> = {
  title: 'Common/KeywordSearchInput',
  component: KeywordSearchInput,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof KeywordSearchInput>

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState('')
    return <KeywordSearchInput value={value} onChange={setValue} onSubmit={() => {}} placeholder="利用者番号または氏名で検索" autoFocus />
  },
}

export const WithError: Story = {
  render: () => {
    const [value, setValue] = useState('あ')
    return <KeywordSearchInput value={value} onChange={setValue} onSubmit={() => {}} placeholder="利用者番号または氏名で検索" error="2 文字以上入力してください" />
  },
}

export const Disabled: Story = {
  render: () => <KeywordSearchInput value="山田" onChange={() => {}} onSubmit={() => {}} placeholder="利用者番号または氏名で検索" disabled />,
}
